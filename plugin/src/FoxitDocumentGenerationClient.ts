import axios from "axios";
import FormData from "form-data";

const BASE = (process.env.FOXIT_DOCGEN_BASE_URL || "").replace(/\/$/, "");
const AUTH_HEADERS: Record<string, string> = {
  client_id: process.env.FOXIT_DOCGEN_CLIENT_ID || "",
  client_secret: process.env.FOXIT_DOCGEN_CLIENT_SECRET || "",
};

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 120_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeError(err: any): string {
  if (!err.response) return err.message;
  try {
    if (Buffer.isBuffer(err.response.data) || err.response.data instanceof ArrayBuffer) {
      return Buffer.from(err.response.data).toString("utf-8");
    }
    return typeof err.response.data === "string"
      ? err.response.data
      : JSON.stringify(err.response.data);
  } catch {
    return String(err.response.status);
  }
}

async function uploadHtml(html: string): Promise<string> {
  const endpoint = `${BASE}/documents/upload`;
  console.log(`[FoxitDocGen] Step 1 — Upload POST ${endpoint}`);

  const form = new FormData();
  form.append("file", Buffer.from(html, "utf-8"), {
    filename: "report.html",
    contentType: "text/html",
  });

  let res;
  try {
    res = await axios.post(endpoint, form, {
      headers: { ...form.getHeaders(), ...AUTH_HEADERS },
      timeout: 30_000,
    });
  } catch (err: any) {
    throw new Error(`[FoxitDocGen] Upload failed (HTTP ${err.response?.status ?? "N/A"}): ${decodeError(err)}`);
  }

  const documentId = res.data?.documentId ?? res.data?.id ?? res.data?.data?.documentId;
  if (!documentId) {
    throw new Error(`[FoxitDocGen] Upload succeeded but no documentId: ${JSON.stringify(res.data)}`);
  }
  console.log(`[FoxitDocGen] Step 1 done documentId=${documentId}`);
  return documentId;
}

async function createPdfTask(documentId: string): Promise<string> {
  const endpoint = `${BASE}/documents/create/pdf-from-html`;
  let res;
  try {
    res = await axios.post(
      endpoint,
      { documentId },
      { headers: { "Content-Type": "application/json", ...AUTH_HEADERS }, timeout: 30_000 }
    );
  } catch (err: any) {
    throw new Error(`[FoxitDocGen] Create-PDF failed (HTTP ${err.response?.status ?? "N/A"}): ${decodeError(err)}`);
  }

  const taskId = res.data?.taskId ?? res.data?.id ?? res.data?.data?.taskId;
  if (!taskId) {
    throw new Error(`[FoxitDocGen] No taskId: ${JSON.stringify(res.data)}`);
  }
  console.log(`[FoxitDocGen] Step 2 done taskId=${taskId}`);
  return taskId;
}

async function pollTask(taskId: string): Promise<string> {
  const endpoint = `${BASE}/tasks/${taskId}`;
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    let res;
    try {
      res = await axios.get(endpoint, { headers: { ...AUTH_HEADERS }, timeout: 15_000 });
    } catch (err: any) {
      throw new Error(`[FoxitDocGen] Poll failed (HTTP ${err.response?.status ?? "N/A"}): ${decodeError(err)}`);
    }

    const { status, progress, resultDocumentId } = res.data;
    console.log(`[FoxitDocGen] status=${status} progress=${progress ?? "?"}%`);

    if (status === "COMPLETED") {
      if (!resultDocumentId) {
        throw new Error("[FoxitDocGen] COMPLETED but no resultDocumentId");
      }
      return resultDocumentId;
    }

    if (status === "FAILED") {
      throw new Error(`[FoxitDocGen] Task FAILED: ${JSON.stringify(res.data)}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`[FoxitDocGen] Timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

async function downloadResult(resultDocumentId: string): Promise<Buffer> {
  const endpoint = `${BASE}/documents/${resultDocumentId}/download`;
  let res;
  try {
    res = await axios.get(endpoint, {
      headers: { ...AUTH_HEADERS, Accept: "application/pdf" },
      responseType: "arraybuffer",
      timeout: 60_000,
    });
  } catch (err: any) {
    throw new Error(`[FoxitDocGen] Download failed (HTTP ${err.response?.status ?? "N/A"}): ${decodeError(err)}`);
  }

  const buf = Buffer.from(res.data);
  console.log(`[FoxitDocGen] PDF downloaded (${buf.length} bytes)`);
  return buf;
}

export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  console.log("[FoxitDocGen] HTML → PDF pipeline start");
  const documentId = await uploadHtml(html);
  const taskId = await createPdfTask(documentId);
  const resultDocumentId = await pollTask(taskId);
  const pdfBuffer = await downloadResult(resultDocumentId);
  console.log(`[FoxitDocGen] Pipeline complete (${pdfBuffer.length} bytes)`);
  return pdfBuffer;
}

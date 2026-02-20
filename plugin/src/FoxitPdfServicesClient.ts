import axios from "axios";
import FormData from "form-data";

const BASE = (process.env.FOXIT_PDFSERVICES_BASE_URL || "").replace(/\/$/, "");
const AUTH_HEADERS: Record<string, string> = {
  client_id: process.env.FOXIT_PDFSERVICES_CLIENT_ID || "",
  client_secret: process.env.FOXIT_PDFSERVICES_CLIENT_SECRET || "",
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

async function uploadPdf(pdfBuffer: Buffer): Promise<string> {
  const endpoint = `${BASE}/documents/upload`;
  const form = new FormData();
  form.append("file", pdfBuffer, {
    filename: "input.pdf",
    contentType: "application/pdf",
    knownLength: pdfBuffer.length,
  });

  let res;
  try {
    res = await axios.post(endpoint, form, {
      headers: { ...form.getHeaders(), ...AUTH_HEADERS },
      timeout: 30_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  } catch (err: any) {
    throw new Error(`[FoxitPdfServices] Upload failed (HTTP ${err.response?.status ?? "N/A"}): ${decodeError(err)}`);
  }

  const documentId = res.data?.documentId ?? res.data?.id ?? res.data?.data?.documentId;
  if (!documentId) {
    throw new Error(`[FoxitPdfServices] No documentId: ${JSON.stringify(res.data)}`);
  }
  return documentId;
}

async function createCompressTask(documentId: string): Promise<string> {
  const endpoint = `${BASE}/documents/modify/pdf-compress`;
  let res;
  try {
    res = await axios.post(
      endpoint,
      { documentId, compressionLevel: "MEDIUM" },
      { headers: { "Content-Type": "application/json", ...AUTH_HEADERS }, timeout: 30_000 }
    );
  } catch (err: any) {
    throw new Error(`[FoxitPdfServices] Compress failed (HTTP ${err.response?.status ?? "N/A"}): ${decodeError(err)}`);
  }

  const taskId = res.data?.taskId ?? res.data?.id ?? res.data?.data?.taskId;
  if (!taskId) {
    throw new Error(`[FoxitPdfServices] No taskId: ${JSON.stringify(res.data)}`);
  }
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
      throw new Error(`[FoxitPdfServices] Poll failed: ${decodeError(err)}`);
    }

    const { status, resultDocumentId } = res.data;
    if (status === "COMPLETED") {
      if (!resultDocumentId) throw new Error("[FoxitPdfServices] No resultDocumentId");
      return resultDocumentId;
    }
    if (status === "FAILED") {
      throw new Error(`[FoxitPdfServices] Task FAILED: ${JSON.stringify(res.data)}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`[FoxitPdfServices] Timed out after ${POLL_TIMEOUT_MS / 1000}s`);
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
    throw new Error(`[FoxitPdfServices] Download failed: ${decodeError(err)}`);
  }
  return Buffer.from(res.data);
}

export async function optimizePdf(pdfBuffer: Buffer): Promise<Buffer> {
  console.log(`[FoxitPdfServices] Compress pipeline start (${pdfBuffer.length} bytes)`);
  const documentId = await uploadPdf(pdfBuffer);
  const taskId = await createCompressTask(documentId);
  const resultDocumentId = await pollTask(taskId);
  const optimized = await downloadResult(resultDocumentId);
  console.log(`[FoxitPdfServices] Compressed (${optimized.length} bytes, ${Math.round((1 - optimized.length / pdfBuffer.length) * 100)}% reduction)`);
  return optimized;
}

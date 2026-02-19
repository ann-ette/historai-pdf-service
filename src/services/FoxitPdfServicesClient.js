'use strict';

/**
 * FoxitPdfServicesClient.js
 *
 * Post-processes (compresses/optimizes) a PDF using the Foxit PDF Services API.
 *
 * Same 4-step async flow as FoxitDocumentGenerationClient, but uses the
 * compress operation instead of html-to-pdf:
 *
 *   Step 1 — Upload PDF
 *     POST /pdf-services/api/documents/upload
 *     Body: multipart/form-data  { file: <pdf bytes> }
 *     → { documentId }
 *
 *   Step 2 — Trigger compress task
 *     POST /pdf-services/api/documents/compress
 *     Body: JSON  { documentId }
 *     → { taskId }
 *
 *   Step 3 — Poll task until COMPLETED
 *     GET /pdf-services/api/tasks/:taskId
 *     → { status, progress, resultDocumentId }
 *
 *   Step 4 — Download optimized PDF
 *     GET /pdf-services/api/documents/:resultDocumentId/download
 *     → raw PDF bytes
 *
 * Environment variables required:
 *   FOXIT_PDFSERVICES_BASE_URL      e.g. https://na1.fusion.foxit.com/pdf-services/api
 *   FOXIT_PDFSERVICES_CLIENT_ID     Sent as `client_id` request header
 *   FOXIT_PDFSERVICES_CLIENT_SECRET Sent as `client_secret` request header
 */

const axios    = require('axios');
const FormData = require('form-data');

// ── Env validation ────────────────────────────────────────────────────────────
const {
  FOXIT_PDFSERVICES_BASE_URL,
  FOXIT_PDFSERVICES_CLIENT_ID,
  FOXIT_PDFSERVICES_CLIENT_SECRET,
} = process.env;

if (!FOXIT_PDFSERVICES_BASE_URL) {
  throw new Error('[FoxitPdfServicesClient] FOXIT_PDFSERVICES_BASE_URL is not set');
}
if (!FOXIT_PDFSERVICES_CLIENT_ID) {
  throw new Error('[FoxitPdfServicesClient] FOXIT_PDFSERVICES_CLIENT_ID is not set');
}
if (!FOXIT_PDFSERVICES_CLIENT_SECRET) {
  throw new Error('[FoxitPdfServicesClient] FOXIT_PDFSERVICES_CLIENT_SECRET is not set');
}

const BASE = FOXIT_PDFSERVICES_BASE_URL.replace(/\/$/, '');

// Auth headers sent on every request
const AUTH_HEADERS = {
  'client_id':     FOXIT_PDFSERVICES_CLIENT_ID,
  'client_secret': FOXIT_PDFSERVICES_CLIENT_SECRET,
};

// Polling config
const POLL_INTERVAL_MS = 3_000;   // check every 3 s
const POLL_TIMEOUT_MS  = 120_000; // give up after 2 min

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function decodeError(err) {
  if (!err.response) return err.message;
  try {
    if (Buffer.isBuffer(err.response.data) || err.response.data instanceof ArrayBuffer) {
      return Buffer.from(err.response.data).toString('utf-8');
    }
    return typeof err.response.data === 'string'
      ? err.response.data
      : JSON.stringify(err.response.data);
  } catch {
    return String(err.response.status);
  }
}

// ── Step 1: Upload PDF ────────────────────────────────────────────────────────

async function uploadPdf(pdfBuffer) {
  const endpoint = `${BASE}/documents/upload`;
  console.log(`[FoxitPdfServicesClient] Step 1 — Upload PDF  POST ${endpoint}`);

  const form = new FormData();
  form.append('file', pdfBuffer, {
    filename:    'input.pdf',
    contentType: 'application/pdf',
    knownLength: pdfBuffer.length,
  });

  let res;
  try {
    res = await axios.post(endpoint, form, {
      headers:          { ...form.getHeaders(), ...AUTH_HEADERS },
      timeout:          30_000,
      maxBodyLength:    Infinity,
      maxContentLength: Infinity,
    });
  } catch (err) {
    throw new Error(
      `[FoxitPdfServicesClient] Upload failed (HTTP ${err.response?.status ?? 'N/A'}): ${decodeError(err)}`
    );
  }

  const documentId = res.data?.documentId ?? res.data?.id ?? res.data?.data?.documentId;
  if (!documentId) {
    throw new Error(
      `[FoxitPdfServicesClient] Upload succeeded but no documentId in response: ${JSON.stringify(res.data)}`
    );
  }
  console.log(`[FoxitPdfServicesClient] Step 1 ✓  documentId=${documentId}`);
  return documentId;
}

// ── Step 2: Trigger compress task ────────────────────────────────────────────

async function createCompressTask(documentId) {
  const endpoint = `${BASE}/documents/modify/pdf-compress`;
  console.log(`[FoxitPdfServicesClient] Step 2 — Compress task  POST ${endpoint}`);

  let res;
  try {
    res = await axios.post(
      endpoint,
      { documentId, compressionLevel: 'MEDIUM' },
      { headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS }, timeout: 30_000 }
    );
  } catch (err) {
    throw new Error(
      `[FoxitPdfServicesClient] Compress task failed (HTTP ${err.response?.status ?? 'N/A'}): ${decodeError(err)}`
    );
  }

  const taskId = res.data?.taskId ?? res.data?.id ?? res.data?.data?.taskId;
  if (!taskId) {
    throw new Error(
      `[FoxitPdfServicesClient] No taskId in response: ${JSON.stringify(res.data)}`
    );
  }
  console.log(`[FoxitPdfServicesClient] Step 2 ✓  taskId=${taskId}`);
  return taskId;
}

// ── Step 3: Poll until COMPLETED ─────────────────────────────────────────────

async function pollTask(taskId) {
  const endpoint = `${BASE}/tasks/${taskId}`;
  console.log(`[FoxitPdfServicesClient] Step 3 — Polling  GET ${endpoint}`);

  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    let res;
    try {
      res = await axios.get(endpoint, { headers: { ...AUTH_HEADERS }, timeout: 15_000 });
    } catch (err) {
      throw new Error(
        `[FoxitPdfServicesClient] Poll failed (HTTP ${err.response?.status ?? 'N/A'}): ${decodeError(err)}`
      );
    }

    const { status, progress, resultDocumentId } = res.data;
    console.log(`[FoxitPdfServicesClient]   status=${status}  progress=${progress ?? '?'}%`);

    if (status === 'COMPLETED') {
      if (!resultDocumentId) {
        throw new Error('[FoxitPdfServicesClient] COMPLETED but no resultDocumentId in response');
      }
      console.log(`[FoxitPdfServicesClient] Step 3 ✓  resultDocumentId=${resultDocumentId}`);
      return resultDocumentId;
    }

    if (status === 'FAILED') {
      throw new Error(`[FoxitPdfServicesClient] Task FAILED: ${JSON.stringify(res.data)}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `[FoxitPdfServicesClient] Timed out after ${POLL_TIMEOUT_MS / 1000}s waiting for task ${taskId}`
  );
}

// ── Step 4: Download optimized PDF ───────────────────────────────────────────

async function downloadResult(resultDocumentId) {
  const endpoint = `${BASE}/documents/${resultDocumentId}/download`;
  console.log(`[FoxitPdfServicesClient] Step 4 — Download  GET ${endpoint}`);

  let res;
  try {
    res = await axios.get(endpoint, {
      headers:      { ...AUTH_HEADERS, Accept: 'application/pdf' },
      responseType: 'arraybuffer',
      timeout:      60_000,
    });
  } catch (err) {
    throw new Error(
      `[FoxitPdfServicesClient] Download failed (HTTP ${err.response?.status ?? 'N/A'}): ${decodeError(err)}`
    );
  }

  const buf = Buffer.from(res.data);
  console.log(`[FoxitPdfServicesClient] Step 4 ✓  Optimized PDF downloaded (${buf.length} bytes)`);
  return buf;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compress and optimize a PDF via the Foxit PDF Services API.
 *
 * @param {Buffer} pdfBuffer  Raw PDF bytes to optimize.
 * @returns {Promise<Buffer>} Optimized PDF bytes.
 */
async function optimizePdf(pdfBuffer) {
  console.log(`[FoxitPdfServicesClient] ── Compress pipeline start (${pdfBuffer.length} bytes input) ──`);
  const documentId       = await uploadPdf(pdfBuffer);
  const taskId           = await createCompressTask(documentId);
  const resultDocumentId = await pollTask(taskId);
  const optimizedBuffer  = await downloadResult(resultDocumentId);
  console.log(
    `[FoxitPdfServicesClient] ── Pipeline complete  (${optimizedBuffer.length} bytes, ` +
    `${Math.round((1 - optimizedBuffer.length / pdfBuffer.length) * 100)}% reduction) ──`
  );
  return optimizedBuffer;
}

module.exports = { optimizePdf };

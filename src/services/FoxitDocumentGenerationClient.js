'use strict';

/**
 * FoxitDocumentGenerationClient.js
 *
 * Converts a rendered HTML string to a PDF using the Foxit PDF Services API.
 *
 * The Foxit PDF Services API is ASYNCHRONOUS. Every operation follows 4 steps:
 *
 *   Step 1 — Upload
 *     POST /pdf-services/api/documents/upload
 *     Body: multipart/form-data  { file: <html bytes as report.html> }
 *     → { documentId }
 *
 *   Step 2 — Trigger HTML → PDF conversion
 *     POST /pdf-services/api/documents/create/pdf-from-html
 *     Body: JSON  { documentId }
 *     → { taskId }
 *
 *   Step 3 — Poll task until COMPLETED
 *     GET /pdf-services/api/tasks/:taskId
 *     → { status, progress, resultDocumentId }
 *
 *   Step 4 — Download result PDF
 *     GET /pdf-services/api/documents/:resultDocumentId/download
 *     → raw PDF bytes
 *
 * Environment variables required:
 *   FOXIT_DOCGEN_BASE_URL      e.g. https://na1.fusion.foxit.com/pdf-services/api
 *   FOXIT_DOCGEN_CLIENT_ID     Sent as `client_id` request header
 *   FOXIT_DOCGEN_CLIENT_SECRET Sent as `client_secret` request header
 *
 * NOTE: This uses the PDF Services API (async upload/convert/download flow).
 *       The separate Foxit Document Generation API (/document-generation/api/GenerateDocumentBase64)
 *       is for DOCX template + JSON → PDF workflows and is not used here.
 */

const axios    = require('axios');
const FormData = require('form-data');

// ── Env validation ────────────────────────────────────────────────────────────
const {
  FOXIT_DOCGEN_BASE_URL,
  FOXIT_DOCGEN_CLIENT_ID,
  FOXIT_DOCGEN_CLIENT_SECRET,
} = process.env;

if (!FOXIT_DOCGEN_BASE_URL) {
  throw new Error('[FoxitDocGenClient] FOXIT_DOCGEN_BASE_URL is not set');
}
if (!FOXIT_DOCGEN_CLIENT_ID) {
  throw new Error('[FoxitDocGenClient] FOXIT_DOCGEN_CLIENT_ID is not set');
}
if (!FOXIT_DOCGEN_CLIENT_SECRET) {
  throw new Error('[FoxitDocGenClient] FOXIT_DOCGEN_CLIENT_SECRET is not set');
}

const BASE = FOXIT_DOCGEN_BASE_URL.replace(/\/$/, '');

// Auth headers sent on every request
const AUTH_HEADERS = {
  'client_id':     FOXIT_DOCGEN_CLIENT_ID,
  'client_secret': FOXIT_DOCGEN_CLIENT_SECRET,
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
    // response.data may be arraybuffer or string depending on responseType
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

// ── Step 1: Upload HTML file ──────────────────────────────────────────────────

async function uploadHtml(html) {
  const endpoint = `${BASE}/documents/upload`;
  console.log(`[FoxitDocGenClient] Step 1 — Upload  POST ${endpoint}`);

  const form = new FormData();
  form.append('file', Buffer.from(html, 'utf-8'), {
    filename:    'report.html',
    contentType: 'text/html',
  });

  let res;
  try {
    res = await axios.post(endpoint, form, {
      headers: { ...form.getHeaders(), ...AUTH_HEADERS },
      timeout: 30_000,
    });
  } catch (err) {
    throw new Error(
      `[FoxitDocGenClient] Upload failed (HTTP ${err.response?.status ?? 'N/A'}): ${decodeError(err)}`
    );
  }

  // Foxit may return documentId at the top level or inside a data wrapper
  const documentId = res.data?.documentId ?? res.data?.id ?? res.data?.data?.documentId;
  if (!documentId) {
    throw new Error(
      `[FoxitDocGenClient] Upload succeeded but no documentId in response: ${JSON.stringify(res.data)}`
    );
  }
  console.log(`[FoxitDocGenClient] Step 1 ✓  documentId=${documentId}`);
  return documentId;
}

// ── Step 2: Trigger HTML → PDF task ──────────────────────────────────────────

async function createPdfTask(documentId) {
  const endpoint = `${BASE}/documents/create/pdf-from-html`;
  console.log(`[FoxitDocGenClient] Step 2 — Create PDF task  POST ${endpoint}`);

  let res;
  try {
    res = await axios.post(
      endpoint,
      { documentId },
      { headers: { 'Content-Type': 'application/json', ...AUTH_HEADERS }, timeout: 30_000 }
    );
  } catch (err) {
    throw new Error(
      `[FoxitDocGenClient] Create-PDF failed (HTTP ${err.response?.status ?? 'N/A'}): ${decodeError(err)}`
    );
  }

  const taskId = res.data?.taskId ?? res.data?.id ?? res.data?.data?.taskId;
  if (!taskId) {
    throw new Error(
      `[FoxitDocGenClient] No taskId in response: ${JSON.stringify(res.data)}`
    );
  }
  console.log(`[FoxitDocGenClient] Step 2 ✓  taskId=${taskId}`);
  return taskId;
}

// ── Step 3: Poll until COMPLETED ─────────────────────────────────────────────

async function pollTask(taskId) {
  const endpoint = `${BASE}/tasks/${taskId}`;
  console.log(`[FoxitDocGenClient] Step 3 — Polling  GET ${endpoint}`);

  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    let res;
    try {
      res = await axios.get(endpoint, { headers: { ...AUTH_HEADERS }, timeout: 15_000 });
    } catch (err) {
      throw new Error(
        `[FoxitDocGenClient] Poll failed (HTTP ${err.response?.status ?? 'N/A'}): ${decodeError(err)}`
      );
    }

    const { status, progress, resultDocumentId } = res.data;
    console.log(`[FoxitDocGenClient]   status=${status}  progress=${progress ?? '?'}%`);

    if (status === 'COMPLETED') {
      if (!resultDocumentId) {
        throw new Error('[FoxitDocGenClient] COMPLETED but no resultDocumentId in response');
      }
      console.log(`[FoxitDocGenClient] Step 3 ✓  resultDocumentId=${resultDocumentId}`);
      return resultDocumentId;
    }

    if (status === 'FAILED') {
      throw new Error(`[FoxitDocGenClient] Task FAILED: ${JSON.stringify(res.data)}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `[FoxitDocGenClient] Timed out after ${POLL_TIMEOUT_MS / 1000}s waiting for task ${taskId}`
  );
}

// ── Step 4: Download result PDF ───────────────────────────────────────────────

async function downloadResult(resultDocumentId) {
  const endpoint = `${BASE}/documents/${resultDocumentId}/download`;
  console.log(`[FoxitDocGenClient] Step 4 — Download  GET ${endpoint}`);

  let res;
  try {
    res = await axios.get(endpoint, {
      headers:      { ...AUTH_HEADERS, Accept: 'application/pdf' },
      responseType: 'arraybuffer',
      timeout:      60_000,
    });
  } catch (err) {
    throw new Error(
      `[FoxitDocGenClient] Download failed (HTTP ${err.response?.status ?? 'N/A'}): ${decodeError(err)}`
    );
  }

  const buf = Buffer.from(res.data);
  console.log(`[FoxitDocGenClient] Step 4 ✓  PDF downloaded (${buf.length} bytes)`);
  return buf;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Convert a fully-rendered HTML string to a PDF via the Foxit PDF Services API.
 *
 * @param {string} html  Complete interpolated HTML document.
 * @returns {Promise<Buffer>}  Generated PDF bytes.
 */
async function generatePdfFromHtml(html) {
  console.log('[FoxitDocGenClient] ── HTML → PDF pipeline start (4 steps) ──');
  const documentId       = await uploadHtml(html);
  const taskId           = await createPdfTask(documentId);
  const resultDocumentId = await pollTask(taskId);
  const pdfBuffer        = await downloadResult(resultDocumentId);
  console.log(`[FoxitDocGenClient] ── Pipeline complete  (${pdfBuffer.length} bytes) ──`);
  return pdfBuffer;
}

module.exports = { generatePdfFromHtml };

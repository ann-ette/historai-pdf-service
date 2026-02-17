'use strict';

/**
 * FoxitPdfServicesClient.js
 *
 * Wraps Foxit's PDF Services API for post-processing operations.
 * Currently used for PDF compression / optimization (linearization),
 * but structured so additional operations (merge, sign, redact, etc.)
 * can be added as separate exported functions later.
 *
 * Environment variables required:
 *   FOXIT_PDFSERVICES_BASE_URL   Base URL of the PDF Services API
 *                                e.g. https://api.foxit.com/pdfservices/v1
 *   FOXIT_PDFSERVICES_API_KEY    Bearer token / API key for the PDF Services API
 *
 * How the optimize endpoint works (assumed Foxit contract):
 *   POST /optimize
 *   Body:  multipart/form-data with a `file` field containing the PDF bytes.
 *   Returns: raw PDF bytes (application/pdf).
 *
 * If Foxit's actual optimize endpoint uses a different shape (e.g. base64 JSON),
 * adjust only the axios call inside optimizePdf() — the rest of the service
 * layer is unaffected.
 */

const axios     = require('axios');
const FormData  = require('form-data');

// ── Env validation at module load ────────────────────────────────────────────
const PDFSERVICES_BASE_URL = process.env.FOXIT_PDFSERVICES_BASE_URL;
const PDFSERVICES_API_KEY  = process.env.FOXIT_PDFSERVICES_API_KEY;

if (!PDFSERVICES_BASE_URL) {
  throw new Error('[FoxitPdfServicesClient] FOXIT_PDFSERVICES_BASE_URL is not set');
}
if (!PDFSERVICES_API_KEY) {
  throw new Error('[FoxitPdfServicesClient] FOXIT_PDFSERVICES_API_KEY is not set');
}

// Build the optimize endpoint URL once.
const OPTIMIZE_ENDPOINT = `${PDFSERVICES_BASE_URL.replace(/\/$/, '')}/optimize`;

/**
 * Compress and optimize a PDF using Foxit's PDF Services API.
 *
 * The function uploads the PDF as a multipart form file, receives the
 * compressed PDF in the response, and returns it as a Buffer.
 *
 * Optimization typically includes:
 *   - Image down-sampling and re-compression
 *   - Removal of redundant objects and whitespace
 *   - PDF linearization ("fast web view") for quicker streaming
 *
 * @param {Buffer} pdfBuffer  The raw PDF bytes to optimize.
 * @returns {Promise<Buffer>} The optimized PDF bytes.
 *
 * @throws {Error} if the HTTP request fails or the response is not a valid PDF.
 */
async function optimizePdf(pdfBuffer) {
  console.log(
    `[FoxitPdfServicesClient] POST ${OPTIMIZE_ENDPOINT} ` +
    `(input: ${pdfBuffer.length} bytes)`
  );

  // Build a multipart/form-data body.
  // `form-data` is bundled with axios as a peer dependency; no extra install needed.
  const form = new FormData();
  form.append('file', pdfBuffer, {
    filename:    'input.pdf',
    contentType: 'application/pdf',
    knownLength: pdfBuffer.length,
  });

  let response;
  try {
    response = await axios.post(
      OPTIMIZE_ENDPOINT,
      form,
      {
        headers: {
          ...form.getHeaders(),                  // sets Content-Type: multipart/form-data; boundary=...
          'Authorization': `Bearer ${PDFSERVICES_API_KEY}`,
          'Accept':        'application/pdf',
        },
        responseType: 'arraybuffer',
        timeout:      45_000,
        maxBodyLength: Infinity,                 // allow large PDF uploads
        maxContentLength: Infinity,
      }
    );
  } catch (err) {
    const status = err.response ? err.response.status : 'N/A';
    const detail = err.response
      ? Buffer.from(err.response.data).toString('utf-8')
      : err.message;
    throw new Error(
      `[FoxitPdfServicesClient] PDF Services optimize failed ` +
      `(HTTP ${status}): ${detail}`
    );
  }

  const optimizedBuffer = Buffer.from(response.data);
  console.log(
    `[FoxitPdfServicesClient] Optimized PDF received (${optimizedBuffer.length} bytes, ` +
    `${Math.round((1 - optimizedBuffer.length / pdfBuffer.length) * 100)}% reduction)`
  );
  return optimizedBuffer;
}

module.exports = { optimizePdf };

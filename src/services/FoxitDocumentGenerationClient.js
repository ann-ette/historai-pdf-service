'use strict';

/**
 * FoxitDocumentGenerationClient.js
 *
 * Wraps Foxit's Document Generation API (HTML → PDF).
 *
 * Environment variables required:
 *   FOXIT_DOCGEN_BASE_URL   Base URL of the Document Generation API
 *                           e.g. https://api.foxit.com/document-generation/v1
 *   FOXIT_DOCGEN_API_KEY    Bearer token / API key for the Document Generation API
 *
 * The client is intentionally stateless — just a thin axios wrapper so
 * the base URL and key can be changed in one place.
 */

const axios = require('axios');

// Validate required env vars once at module load so a misconfiguration
// surfaces immediately at startup rather than on the first request.
const DOCGEN_BASE_URL = process.env.FOXIT_DOCGEN_BASE_URL;
const DOCGEN_API_KEY  = process.env.FOXIT_DOCGEN_API_KEY;

if (!DOCGEN_BASE_URL) {
  throw new Error('[FoxitDocumentGenerationClient] FOXIT_DOCGEN_BASE_URL is not set');
}
if (!DOCGEN_API_KEY) {
  throw new Error('[FoxitDocumentGenerationClient] FOXIT_DOCGEN_API_KEY is not set');
}

// Build the full endpoint once so it's easy to change the path later.
const DOCGEN_ENDPOINT = `${DOCGEN_BASE_URL.replace(/\/$/, '')}/html-to-pdf`;

/**
 * Generate a PDF from a fully-rendered HTML string using Foxit's
 * Document Generation API.
 *
 * The function sends the HTML as the `html` field of a JSON body and
 * expects the API to return raw PDF bytes (application/pdf).
 *
 * @param {string} html  The complete, interpolated HTML document to convert.
 * @returns {Promise<Buffer>}  A Node.js Buffer containing the PDF bytes.
 *
 * @throws {Error} if the HTTP request fails or the response is not a valid PDF.
 */
async function generatePdfFromHtml(html) {
  console.log(`[FoxitDocumentGenerationClient] POST ${DOCGEN_ENDPOINT}`);

  let response;
  try {
    response = await axios.post(
      DOCGEN_ENDPOINT,
      { html },
      {
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${DOCGEN_API_KEY}`,
          'Accept':        'application/pdf',
        },
        responseType: 'arraybuffer',
        timeout:      45_000, // ms — HTML-to-PDF can take a moment for complex pages
      }
    );
  } catch (err) {
    const status = err.response ? err.response.status : 'N/A';
    const detail = err.response
      ? Buffer.from(err.response.data).toString('utf-8')
      : err.message;
    throw new Error(
      `[FoxitDocumentGenerationClient] Document Generation API failed ` +
      `(HTTP ${status}): ${detail}`
    );
  }

  const pdfBuffer = Buffer.from(response.data);
  console.log(
    `[FoxitDocumentGenerationClient] Received initial PDF (${pdfBuffer.length} bytes)`
  );
  return pdfBuffer;
}

module.exports = { generatePdfFromHtml };

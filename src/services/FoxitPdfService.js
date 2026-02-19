'use strict';

/**
 * FoxitPdfService.js
 *
 * Orchestrator that implements the PdfService interface by running the
 * HistorAI Conversation Summary through a two-stage Foxit pipeline:
 *
 *   Stage 1 — Document Generation API  (HTML → initial PDF)
 *     FoxitDocumentGenerationClient.generatePdfFromHtml(filledHtml)
 *     Env vars: FOXIT_DOCGEN_BASE_URL, FOXIT_DOCGEN_CLIENT_ID, FOXIT_DOCGEN_CLIENT_SECRET
 *
 *   Stage 2 — PDF Services API  (PDF → compressed / optimized PDF)
 *     FoxitPdfServicesClient.optimizePdf(initialPdfBuffer)
 *     Env vars: FOXIT_PDFSERVICES_BASE_URL, FOXIT_PDFSERVICES_CLIENT_ID, FOXIT_PDFSERVICES_CLIENT_SECRET
 *
 * The public interface (generateConversationReport) is unchanged.
 * Only the underlying clients and their env vars differ from the original.
 */

const fs   = require('fs');
const path = require('path');

const PdfService = require('./PdfService');
const { generatePdfFromHtml } = require('./FoxitDocumentGenerationClient');
const { optimizePdf }         = require('./FoxitPdfServicesClient');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'conversation-report.html');

class FoxitPdfService extends PdfService {
  constructor() {
    super();
    // Both clients validate their own env vars when their modules are first
    // required above — no extra validation needed here.
    // This constructor is kept so callers can still do `new FoxitPdfService()`.
  }

  // ── Template interpolation ─────────────────────────────────────────────────

  /**
   * Replace all {{token}} occurrences in the template string.
   * Supports:
   *   {{scalar}}          → data.scalar
   *   {{array[i]}}        → data.array[i]
   *   {{array[i].field}}  → data.array[i].field
   *
   * (Unchanged from original implementation.)
   *
   * @param {string} template
   * @param {object} data
   * @returns {string}
   */
  _interpolate(template, data) {
    // 1. Indexed array + property: {{array[i].field}}
    let result = template.replace(
      /\{\{(\w+)\[(\d+)\]\.(\w+)\}\}/g,
      (match, arrayName, index, field) => {
        const arr = data[arrayName];
        if (Array.isArray(arr) && arr[index] !== undefined) {
          return arr[index][field] !== undefined ? arr[index][field] : '';
        }
        return '';
      }
    );

    // 2. Bare indexed array: {{array[i]}}
    result = result.replace(
      /\{\{(\w+)\[(\d+)\]\}\}/g,
      (match, arrayName, index) => {
        const arr = data[arrayName];
        if (Array.isArray(arr) && arr[index] !== undefined) {
          return arr[index];
        }
        return '';
      }
    );

    // 3. Scalar: {{key}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : '';
    });

    return result;
  }

  // ── Main pipeline ──────────────────────────────────────────────────────────

  /**
   * Generate a fully optimized HistorAI Conversation Summary PDF.
   *
   * Pipeline:
   *   data  →  HTML template interpolation
   *         →  [Stage 1] Foxit Document Generation API  →  initial PDF Buffer
   *         →  [Stage 2] Foxit PDF Services API         →  optimized PDF Buffer
   *         →  return to caller
   *
   * @param {import('./PdfService').ReportData} data
   * @returns {Promise<Buffer>}  Optimized PDF bytes.
   */
  async generateConversationReport(data) {
    // ── Step 1: Read and interpolate the HTML template ─────────────────────
    let template;
    try {
      template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
    } catch (err) {
      throw new Error(`[FoxitPdfService] Failed to read HTML template: ${err.message}`);
    }

    const filledHtml = this._interpolate(template, data);
    console.log('[FoxitPdfService] Template interpolated — starting two-stage pipeline');

    // ── Step 2 (Stage 1): Document Generation API → initial PDF ───────────
    console.log('[FoxitPdfService] Stage 1 → Document Generation API (HTML → PDF)');
    let initialPdfBuffer;
    try {
      initialPdfBuffer = await generatePdfFromHtml(filledHtml);
    } catch (err) {
      // Re-throw with pipeline context so the caller's error message is clear
      throw new Error(`[FoxitPdfService] Stage 1 failed: ${err.message}`);
    }

    // ── Step 3 (Stage 2): PDF Services API → optimized PDF ────────────────
    console.log('[FoxitPdfService] Stage 2 → PDF Services API (compress / optimize)');
    let optimizedPdfBuffer;
    try {
      optimizedPdfBuffer = await optimizePdf(initialPdfBuffer);
    } catch (err) {
      throw new Error(`[FoxitPdfService] Stage 2 failed: ${err.message}`);
    }

    console.log(
      `[FoxitPdfService] Pipeline complete — final PDF: ${optimizedPdfBuffer.length} bytes`
    );
    return optimizedPdfBuffer;
  }
}

module.exports = FoxitPdfService;

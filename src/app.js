'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', 'config', '.env') });

const express = require('express');
const { extractReportData } = require('./utils/llmProcessor');
const FoxitPdfService = require('./services/FoxitPdfService');

const app = express();
app.use(express.json());

// Initialise Foxit service once (constructor validates env vars)
let foxitPdfService;
try {
  foxitPdfService = new FoxitPdfService();
} catch (err) {
  console.error(`[startup] Failed to initialise FoxitPdfService: ${err.message}`);
  console.error('[startup] Make sure FOXIT_DOCGEN_BASE_URL, FOXIT_DOCGEN_API_KEY, FOXIT_PDFSERVICES_BASE_URL, and FOXIT_PDFSERVICES_API_KEY are set in config/.env');
  process.exit(1);
}

/**
 * POST /api/generate-report
 *
 * Body (JSON):
 * {
 *   transcript:       string,
 *   characterName:    string,
 *   characterImageUrl:string,
 *   characterMetadata:{
 *     tagline:   string,
 *     birthYear: string,
 *     deathYear: string,
 *     bio:       string,
 *     facts:     string[]
 *   },
 *   sessionDate:     string,
 *   sessionDuration: string,
 *   userName:        string
 * }
 *
 * Response: application/pdf binary
 */
app.post('/api/generate-report', async (req, res) => {
  const {
    transcript,
    characterName,
    characterImageUrl,
    characterMetadata,
    sessionDate,
    sessionDuration,
    userName,
  } = req.body;

  // Basic validation
  if (!characterName) {
    return res.status(400).json({ error: 'characterName is required' });
  }

  try {
    console.log(`[/api/generate-report] Processing report for "${characterName}"`);

    // 1. Extract structured report data (stub or future LLM call)
    const reportData = await extractReportData({
      transcript: transcript || '',
      characterName,
      characterMetadata: characterMetadata || {},
    });

    // 2. Merge in session fields that come directly from the API caller
    const data = {
      ...reportData,
      characterImageUrl: characterImageUrl || '',
      sessionDate:       sessionDate       || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      sessionDuration:   sessionDuration   || 'Unknown',
      userName:          userName          || 'Anonymous',
    };

    // 3. Generate PDF
    const pdfBuffer = await foxitPdfService.generateConversationReport(data);

    // 4. Send PDF
    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': 'attachment; filename="historai-conversation-summary.pdf"',
      'Content-Length':      pdfBuffer.length,
    });
    return res.end(pdfBuffer);

  } catch (err) {
    console.error(`[/api/generate-report] Error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'historai-pdf-gen' });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`[HistorAI PDF Gen] Server running on http://localhost:${PORT}`);
  console.log(`[HistorAI PDF Gen] POST http://localhost:${PORT}/api/generate-report`);
});

module.exports = app;

# HistorAI PDF Gen

A standalone Node.js/Express service that generates **HistorAI Conversation Summary** PDFs using two distinct Foxit APIs in sequence.

Given a conversation transcript and character metadata, the service:
1. Extracts structured report data (via an LLM stub, swappable for a real LLM call).
2. Injects the data into a two-page HTML report template.
3. **Stage 1 — Document Generation API:** sends the rendered HTML to Foxit's Document Generation API to produce the initial HistorAI Conversation Summary PDF.
4. **Stage 2 — PDF Services API:** passes that initial PDF through Foxit's PDF Services API to compress, optimize, and linearize it.
5. Returns the final, production-ready PDF to the caller.

---

## Two-Stage Foxit Pipeline

```
Report data (characterName, themes, resources, etc.)
    │
    ▼
HTML template interpolation  (conversation-report.html)
    │
    ▼  Stage 1 — Document Generation API
FoxitDocumentGenerationClient.generatePdfFromHtml(html)
    POST $FOXIT_DOCGEN_BASE_URL/html-to-pdf
    → initial PDF Buffer  (full layout, fonts, images)
    │
    ▼  Stage 2 — PDF Services API
FoxitPdfServicesClient.optimizePdf(initialPdfBuffer)
    POST $FOXIT_PDFSERVICES_BASE_URL/optimize
    → optimized PDF Buffer  (smaller, linearized)
    │
    ▼
HTTP response  →  output/einstein-report.pdf
```

**Document Generation API** (`FoxitDocumentGenerationClient`): converts the fully rendered, two-page HTML into a structured PDF. This is the "content creation" step — layout, fonts, and images are all handled here.

**PDF Services API** (`FoxitPdfServicesClient`): post-processes the generated PDF to reduce file size (image downsampling, object deduplication) and linearize it for fast web delivery. This is the "optimization" step.

---

## Project Structure

```
.
├── config/
│   └── .env.example                    # Copy to config/.env and fill in your keys
├── output/                             # Generated PDFs land here (test script)
├── src/
│   ├── services/
│   │   ├── PdfService.js               # Abstract base class / interface
│   │   ├── FoxitPdfService.js          # Orchestrator: runs both stages in sequence
│   │   ├── FoxitDocumentGenerationClient.js  # Stage 1: HTML → PDF
│   │   └── FoxitPdfServicesClient.js         # Stage 2: PDF → optimized PDF
│   ├── templates/
│   │   └── conversation-report.html    # 2-page PDF template with {{tokens}}
│   ├── utils/
│   │   └── llmProcessor.js             # LLM stub (realistic Einstein example data)
│   ├── app.js                          # Express server
│   └── testEinstein.js                 # Integration test / demo script
├── package.json
└── README.md
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp config/.env.example config/.env
```

Open `config/.env` and fill in all six Foxit variables:

| Variable                        | Stage | Description                                                                              |
|---------------------------------|-------|------------------------------------------------------------------------------------------|
| `FOXIT_DOCGEN_BASE_URL`         | 1     | Base URL of the Document Generation API, e.g. `https://api.foxit.com/document-generation/v1` |
| `FOXIT_DOCGEN_CLIENT_ID`        | 1     | Client ID for the Document Generation API (`X-Client-Id` header)                        |
| `FOXIT_DOCGEN_CLIENT_SECRET`    | 1     | Client Secret for the Document Generation API (`X-Client-Secret` header)                |
| `FOXIT_PDFSERVICES_BASE_URL`    | 2     | Base URL of the PDF Services API, e.g. `https://api.foxit.com/pdfservices/v1`           |
| `FOXIT_PDFSERVICES_CLIENT_ID`   | 2     | Client ID for the PDF Services API (`X-Client-Id` header)                               |
| `FOXIT_PDFSERVICES_CLIENT_SECRET`| 2    | Client Secret for the PDF Services API (`X-Client-Secret` header)                       |
| `PORT`                          | —     | Port for the Express server (default `3000`)                                             |

Auth is sent via `X-Client-Id` / `X-Client-Secret` request headers on every API call — no Bearer tokens or API keys needed.

---

## Running locally

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

The server will log:
```
[HistorAI PDF Gen] Server running on http://localhost:3000
[HistorAI PDF Gen] POST http://localhost:3000/api/generate-report
```

---

## API

### `POST /api/generate-report`

**Request body** (JSON):

```json
{
  "transcript":        "Raw conversation text...",
  "characterName":     "Albert Einstein",
  "characterImageUrl": "https://example.com/einstein.jpg",
  "characterMetadata": {
    "tagline":   "Theoretical Physicist & Humanitarian",
    "birthYear": "1879",
    "deathYear": "1955",
    "bio":       "Short 1-2 sentence biography.",
    "facts":     ["Fact one.", "Fact two.", "Fact three.", "Fact four.", "Fact five."]
  },
  "sessionDate":     "February 17, 2026",
  "sessionDuration": "28 minutes",
  "userName":        "Jane Doe"
}
```

**Response**: `application/pdf` binary — the result of Stage 1 (generation) **and** Stage 2 (optimization):
```
Content-Disposition: attachment; filename="historai-conversation-summary.pdf"
```

**Error** (non-2xx): `{ "error": "message" }` JSON.

---

### `GET /health`

Returns `{ "status": "ok", "service": "historai-pdf-gen" }`.

---

## Example curl

```bash
curl -X POST http://localhost:3000/api/generate-report \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "User: What inspired relativity?\nEinstein: A thought experiment about riding a beam of light.",
    "characterName": "Albert Einstein",
    "characterImageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Albert_Einstein_Head.jpg/220px-Albert_Einstein_Head.jpg",
    "characterMetadata": {
      "tagline": "Theoretical Physicist & Humanitarian",
      "birthYear": "1879",
      "deathYear": "1955",
      "bio": "Einstein revolutionised physics with his theories of relativity and won the 1921 Nobel Prize.",
      "facts": [
        "Born 14 March 1879 in Ulm, Germany.",
        "Published four landmark papers in 1905 alone.",
        "Declined the presidency of Israel in 1952.",
        "Played violin; Mozart was his favourite.",
        "Co-signed the Russell-Einstein Manifesto in 1955."
      ]
    },
    "sessionDate": "February 17, 2026",
    "sessionDuration": "28 minutes",
    "userName": "Jane Doe"
  }' \
  --output einstein-report.pdf
```

The resulting PDF has gone through both the Document Generation API (Stage 1) and the PDF Services optimization API (Stage 2).

---

## Integration test

With the server running, execute:

```bash
node src/testEinstein.js
```

This sends a full Einstein payload and saves the final, optimized PDF to `output/einstein-report.pdf`. No changes to `testEinstein.js` are needed — the two-stage pipeline is transparent to the caller.

---

## Swapping in a real LLM

Edit `src/utils/llmProcessor.js`. The `extractReportData({ transcript, characterName, characterMetadata })` function is the only integration point. Replace the hardcoded return value with an API call to OpenAI, Anthropic, etc., and return an object matching the `ReportData` shape documented in `src/services/PdfService.js`.

---

## Deploying to Replit

1. Import the repo into Replit.
2. Add all six Foxit environment variables (`FOXIT_DOCGEN_BASE_URL`, `FOXIT_DOCGEN_CLIENT_ID`, `FOXIT_DOCGEN_CLIENT_SECRET`, `FOXIT_PDFSERVICES_BASE_URL`, `FOXIT_PDFSERVICES_CLIENT_ID`, `FOXIT_PDFSERVICES_CLIENT_SECRET`) plus `PORT` in Replit's **Secrets** panel.
3. Set the run command to `npm start`.
4. Replit will expose a public URL — update your HistorAI backend to point at it.

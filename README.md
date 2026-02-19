# HistorAI PDF Gen

A standalone Node.js/Express service that generates **HistorAI Conversation Summary** PDFs using the Foxit PDF Services API in two stages.

Given a conversation transcript and character metadata, the service:
1. Extracts structured report data (via an LLM stub, swappable for a real LLM call).
2. Injects the data into a two-page HTML report template.
3. **Stage 1 — HTML → PDF:** uploads the rendered HTML to Foxit and converts it to a PDF.
4. **Stage 2 — Compress:** passes the PDF through Foxit's compress operation to reduce file size.
5. Returns the final PDF to the caller.

---

## Pipeline

```
Request (transcript + character metadata)
    │
    ▼
LLM stub extracts themes, summary, resources, etc.
    │
    ▼
HTML template interpolation  (src/templates/conversation-report.html)
    │
    ▼  Stage 1
POST /documents/upload  →  documentId
POST /documents/create/pdf-from-html  →  taskId
GET  /tasks/:taskId  (poll until COMPLETED)
GET  /documents/:resultDocumentId/download  →  PDF buffer
    │
    ▼  Stage 2
POST /documents/upload  →  documentId
POST /documents/modify/pdf-compress  →  taskId
GET  /tasks/:taskId  (poll until COMPLETED)
GET  /documents/:resultDocumentId/download  →  compressed PDF
    │
    ▼
HTTP response  →  application/pdf
```

---

## Project Structure

```
.
├── config/
│   ├── .env.example        # Copy to config/.env and fill in your keys (local dev only)
│   └── .env                # Your real credentials — gitignored, never committed
├── output/                 # Generated PDFs land here when using testEinstein.js
├── src/
│   ├── services/
│   │   ├── PdfService.js                     # Abstract base class
│   │   ├── FoxitPdfService.js                # Orchestrator: runs Stage 1 + Stage 2
│   │   ├── FoxitDocumentGenerationClient.js  # Stage 1: HTML → PDF
│   │   └── FoxitPdfServicesClient.js         # Stage 2: compress PDF
│   ├── templates/
│   │   └── conversation-report.html          # 2-page PDF template with {{tokens}}
│   ├── utils/
│   │   └── llmProcessor.js                   # LLM stub (swap for real LLM here)
│   ├── app.js                                # Express server
│   └── testEinstein.js                       # Integration test script
├── .gitignore
├── package.json
└── README.md
```

---

## Setup (Local)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure credentials

```bash
cp config/.env.example config/.env
```

Open `config/.env` and fill in your Foxit credentials. Both stages use the **Foxit PDF Services API** — use the same `client_id` and `client_secret` for both:

| Variable                          | Value                                                  |
|-----------------------------------|--------------------------------------------------------|
| `FOXIT_DOCGEN_BASE_URL`           | `https://na1.fusion.foxit.com/pdf-services/api`        |
| `FOXIT_DOCGEN_CLIENT_ID`          | Your Foxit PDF Services client ID                      |
| `FOXIT_DOCGEN_CLIENT_SECRET`      | Your Foxit PDF Services client secret                  |
| `FOXIT_PDFSERVICES_BASE_URL`      | `https://na1.fusion.foxit.com/pdf-services/api`        |
| `FOXIT_PDFSERVICES_CLIENT_ID`     | Your Foxit PDF Services client ID (same as above)      |
| `FOXIT_PDFSERVICES_CLIENT_SECRET` | Your Foxit PDF Services client secret (same as above)  |
| `PORT`                            | `3000` (or any available port)                         |

> Get your credentials from [developer-api.foxit.com](https://developer-api.foxit.com) → your app → PDF Services API.

### 3. Start the server

```bash
# Production
npm start

# Development (auto-restart on file changes)
npm run dev
```

---

## Testing locally

With the server running, in a second terminal:

```bash
node src/testEinstein.js
```

This sends a full Einstein payload and saves the PDF to `output/einstein-report.pdf`.

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

**Response:** `application/pdf` binary
```
Content-Disposition: attachment; filename="historai-conversation-summary.pdf"
```

**Error (non-2xx):** `{ "error": "message" }`

---

### `GET /health`

Returns `{ "status": "ok", "service": "historai-pdf-gen" }`.

---

## Deploying to Replit

1. Import this repo into Replit.
2. In the **Secrets** panel, add all 6 Foxit variables (do **not** add a `config/.env` file — Replit uses Secrets instead):
   - `FOXIT_DOCGEN_BASE_URL` → `https://na1.fusion.foxit.com/pdf-services/api`
   - `FOXIT_DOCGEN_CLIENT_ID`
   - `FOXIT_DOCGEN_CLIENT_SECRET`
   - `FOXIT_PDFSERVICES_BASE_URL` → `https://na1.fusion.foxit.com/pdf-services/api`
   - `FOXIT_PDFSERVICES_CLIENT_ID`
   - `FOXIT_PDFSERVICES_CLIENT_SECRET`
3. Set the run command to `npm start`.
4. Replit will expose a public URL — use that as the base URL in your HistorAI backend.

---

## Swapping in a real LLM

Edit `src/utils/llmProcessor.js`. The `extractReportData({ transcript, characterName, characterMetadata })` function is the only integration point. Replace the hardcoded return value with an API call to OpenAI, Anthropic, etc., and return an object matching the `ReportData` shape documented in `src/services/PdfService.js`.

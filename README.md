# HistorAI PDF Gen

> **Foxit API Hackathon Submission**

## Project Pitch

HistorAI lets users have live AI conversations with historical figures. After each session, users deserve more than a chat log — they deserve a polished, shareable takeaway.

**HistorAI PDF Gen** is the microservice that makes that happen. It takes a raw conversation transcript and character metadata, and automatically generates a beautiful two-page **Conversation Summary Report** PDF — complete with themes, quotes, historical context, reflection questions, and further reading. Every PDF is generated fresh on-demand and compressed for fast delivery.

This is a fully automated **input → output** pipeline: raw conversation data goes in, a production-ready PDF comes out.

---

## Demo

**Test it locally in under 2 minutes** — see [Setup](#setup-local) below.

The included Einstein demo generates this report from a single command:

```
node src/testEinstein.js
→ output/einstein-report.pdf  (2-page conversation summary, ~140KB)
```

---

## Where Each Foxit API Is Used

### Document Generation API — `FoxitDocumentGenerationClient.js`

**What it does:** Converts a fully-rendered, dynamic HTML report into a structured PDF.

**Why:** Each conversation is unique — different character, different themes, different quotes. The HTML template is populated at runtime with extracted data, then sent to the Document Generation API to produce a pixel-perfect, multi-page PDF with proper fonts, layout, and images. This is the "creation" step — it turns structured data into a real document.

**Endpoints used:**
- `POST /documents/upload` — uploads the rendered HTML
- `POST /documents/create/pdf-from-html` — triggers async HTML → PDF conversion
- `GET /tasks/:taskId` — polls until complete
- `GET /documents/:resultDocumentId/download` — downloads the generated PDF

---

### PDF Services API — `FoxitPdfServicesClient.js`

**What it does:** Compresses and optimises the generated PDF before delivery.

**Why:** The generated PDF is comprehensive and image-heavy. Before sending it to the end user, we run it through the PDF Services compress operation to reduce file size (typically 10–15% reduction) without visible quality loss. This makes the PDF faster to download and cheaper to store — important for a production app serving many users.

**Endpoints used:**
- `POST /documents/upload` — uploads the generated PDF
- `POST /documents/modify/pdf-compress` — triggers async compression (level: MEDIUM)
- `GET /tasks/:taskId` — polls until complete
- `GET /documents/:resultDocumentId/download` — downloads the optimised PDF

---

## Architecture

```
POST /api/generate-report
  { transcript, characterName, characterMetadata, sessionDate, ... }
          │
          ▼
  llmProcessor.js
  Extracts structured data from the transcript:
  themes, summary, headline insight, reflection questions, resources
          │
          ▼
  conversation-report.html  ({{token}} interpolation)
  Two-page HTML report rendered with all extracted data
          │
          ▼  ── FOXIT DOCUMENT GENERATION API ──
  Upload HTML  →  trigger html-to-pdf task  →  poll  →  download PDF
          │
          ▼  ── FOXIT PDF SERVICES API ──
  Upload PDF  →  trigger compress task  →  poll  →  download compressed PDF
          │
          ▼
  HTTP response: application/pdf
  Content-Disposition: attachment; filename="historai-conversation-summary.pdf"
```

**Stack:** Node.js · Express · Axios · Foxit PDF Services API

**Data handling:** No conversation data or PDFs are stored by this service. The pipeline is stateless — data flows through in memory and the final PDF is streamed directly to the caller. Foxit's temporary document IDs expire after the task completes.

---

## Project Structure

```
.
├── config/
│   ├── .env.example        # Credential template — copy to config/.env for local dev
│   └── .env                # Your real credentials — gitignored, never committed
├── output/                 # Test PDFs land here (gitignored)
├── src/
│   ├── services/
│   │   ├── PdfService.js                     # Abstract base class / interface
│   │   ├── FoxitPdfService.js                # Orchestrator: Stage 1 + Stage 2
│   │   ├── FoxitDocumentGenerationClient.js  # Stage 1: HTML → PDF
│   │   └── FoxitPdfServicesClient.js         # Stage 2: compress PDF
│   ├── templates/
│   │   └── conversation-report.html          # 2-page PDF template with {{tokens}}
│   ├── utils/
│   │   └── llmProcessor.js                   # Data extraction stub (swap for real LLM)
│   ├── app.js                                # Express server
│   └── testEinstein.js                       # End-to-end integration test
├── .gitignore
├── package.json
└── README.md
```

---

## Setup (Local)

### 1. Clone and install

```bash
git clone https://github.com/ann-ette/historai-pdf-service.git
cd historai-pdf-service
npm install
```

### 2. Get Foxit credentials

1. Create a free account at [developer-api.foxit.com](https://developer-api.foxit.com)
2. Create a new app/project
3. Copy your **PDF Services API** `client_id` and `client_secret`

### 3. Configure environment

```bash
cp config/.env.example config/.env
```

Edit `config/.env`:

```env
FOXIT_DOCGEN_BASE_URL=https://na1.fusion.foxit.com/pdf-services/api
FOXIT_DOCGEN_CLIENT_ID=your_client_id_here
FOXIT_DOCGEN_CLIENT_SECRET=your_client_secret_here

FOXIT_PDFSERVICES_BASE_URL=https://na1.fusion.foxit.com/pdf-services/api
FOXIT_PDFSERVICES_CLIENT_ID=your_client_id_here
FOXIT_PDFSERVICES_CLIENT_SECRET=your_client_secret_here

PORT=3000
```

> Both stages use the same Foxit PDF Services API credentials.

### 4. Start the server

```bash
npm start
```

### 5. Run the end-to-end test

In a second terminal:

```bash
node src/testEinstein.js
```

Open `output/einstein-report.pdf` to see the generated report.

---

## API Reference

### `POST /api/generate-report`

**Request body (JSON):**

```json
{
  "transcript":        "User: What inspired relativity?\nEinstein: ...",
  "characterName":     "Albert Einstein",
  "characterImageUrl": "https://example.com/einstein.jpg",
  "characterMetadata": {
    "tagline":   "Theoretical Physicist & Humanitarian",
    "birthYear": "1879",
    "deathYear": "1955",
    "bio":       "Short biography.",
    "facts":     ["Fact 1", "Fact 2", "Fact 3", "Fact 4", "Fact 5"]
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

### `GET /health`

Returns `{ "status": "ok", "service": "historai-pdf-gen" }`.

---

## Deploying to Replit

1. Import this repo into Replit
2. In the **Secrets** panel, add:
   - `FOXIT_DOCGEN_BASE_URL` → `https://na1.fusion.foxit.com/pdf-services/api`
   - `FOXIT_DOCGEN_CLIENT_ID`
   - `FOXIT_DOCGEN_CLIENT_SECRET`
   - `FOXIT_PDFSERVICES_BASE_URL` → `https://na1.fusion.foxit.com/pdf-services/api`
   - `FOXIT_PDFSERVICES_CLIENT_ID`
   - `FOXIT_PDFSERVICES_CLIENT_SECRET`
3. Set run command to `npm start`
4. Use the Replit public URL as the base URL in your HistorAI backend

---

## Extending This Project

**Swap in a real LLM:** Edit `src/utils/llmProcessor.js`. The `extractReportData({ transcript, characterName, characterMetadata })` function is the only integration point — replace the stub return value with a call to OpenAI, Anthropic Claude, etc.

**Customise the report:** Edit `src/templates/conversation-report.html`. All dynamic values are injected via `{{token}}` placeholders.

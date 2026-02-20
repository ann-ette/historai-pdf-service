# HistorAI Foxit Plugin

A standalone TypeScript module that integrates the **Foxit Document Generation API** and **Foxit PDF Services API** into any Node.js application to generate and optimise PDF reports from HTML templates.

Extracted from the HistorAI production integration — adapted for drop-in use.

---

## What Changed From the Starter Code

This plugin reflects the changes required to get the Foxit APIs working end-to-end in a real app:

| File | Changes Made |
|------|-------------|
| `FoxitDocumentGenerationClient.ts` | Added `decodeError()` helper for reliable error decoding across Buffer, ArrayBuffer, string, and JSON responses. Added flexible `documentId` extraction to handle multiple API response shapes. |
| `FoxitPdfServicesClient.ts` | Same `decodeError()` improvement. Added `maxBodyLength: Infinity` and `maxContentLength: Infinity` to handle large PDFs without axios truncating them. Added `knownLength` on multipart form append for reliable uploads. |
| `pdfReportService.ts` | **New.** Orchestration layer: reads HTML template from disk, runs `{{token}}` interpolation (supports scalar, `array[i]`, and `array[i].field` patterns), calls Stage 1 then Stage 2, and gracefully falls back to the uncompressed PDF if compression fails. |
| `conversation-report.html` | **New.** Production HTML template with embedded base64 font support, `break-inside: avoid` for clean page breaks, and a professional two-page layout (themes, resources, reflection questions). |
| `index.ts` | **New.** Clean barrel export for all public functions and types. |

---

## Pipeline

```
ReportData (characterName, themes, resources, etc.)
        │
        ▼
  HTML template  ({{token}} interpolation)
        │
        ▼  Stage 1 — Foxit Document Generation API
  Upload HTML  →  trigger html-to-pdf  →  poll  →  download PDF
        │
        ▼  Stage 2 — Foxit PDF Services API
  Upload PDF  →  trigger compress  →  poll  →  download compressed PDF
        │
        ▼
  Buffer  (optimised PDF, ready to stream or save)
```

If Stage 2 compression fails, the uncompressed Stage 1 PDF is returned — the user always gets their document.

---

## Environment Variables

```bash
# Stage 1 — Document Generation API
FOXIT_DOCGEN_BASE_URL=https://na1.fusion.foxit.com/pdf-services/api
FOXIT_DOCGEN_CLIENT_ID=your_client_id
FOXIT_DOCGEN_CLIENT_SECRET=your_client_secret

# Stage 2 — PDF Services API
FOXIT_PDFSERVICES_BASE_URL=https://na1.fusion.foxit.com/pdf-services/api
FOXIT_PDFSERVICES_CLIENT_ID=your_client_id
FOXIT_PDFSERVICES_CLIENT_SECRET=your_client_secret
```

> Both stages use the same Foxit PDF Services API credentials and base URL.

---

## Usage

### Full pipeline

```typescript
import { generateConversationReport, ReportData } from "./src";

const data: ReportData = {
  characterName:     "Marcus Aurelius",
  characterTagline:  "Roman Emperor & Stoic Philosopher",
  characterBirthYear:"121 AD",
  characterDeathYear:"180 AD",
  characterBio:      "The last of the Five Good Emperors...",
  characterImageUrl: "https://example.com/marcus.jpg",
  characterFacts:    ["Wrote Meditations while on military campaigns", ...],
  sessionDate:       "February 20, 2026",
  sessionDuration:   "12 minutes",
  userName:          "Guest",
  sessionSummary:    "A deep conversation about Stoic philosophy...",
  headlineInsight:   "The obstacle is the way.",
  themes: [
    { name: "Stoicism", explanation: "...", quote: "...", context: "..." },
  ],
  resources: [
    { topic: "Meditations", whyItMatters: "...", whereToLearnMore: "..." },
  ],
  reflectionQuestions: ["How might you apply Stoic principles today?"],
  mynerveFont: "", // optional: base64-encoded font string
};

const pdfBuffer = await generateConversationReport(data);
// pdfBuffer is a Node.js Buffer — stream it, save it, or return it as HTTP response
```

### Use each API independently

```typescript
import { generatePdfFromHtml } from "./src/FoxitDocumentGenerationClient";
import { optimizePdf }         from "./src/FoxitPdfServicesClient";

// Convert any HTML string to PDF
const rawPdf = await generatePdfFromHtml("<html><body><h1>Hello</h1></body></html>");

// Compress any existing PDF buffer
const smallerPdf = await optimizePdf(rawPdf);
```

---

## Template System

The HTML template uses `{{mustache}}` placeholders replaced at runtime:

| Pattern | Example | Resolves to |
|---------|---------|-------------|
| `{{variable}}` | `{{characterName}}` | `data.characterName` |
| `{{array[i]}}` | `{{reflectionQuestions[0]}}` | `data.reflectionQuestions[0]` |
| `{{array[i].field}}` | `{{themes[0].name}}` | `data.themes[0].name` |

See `templates/conversation-report.html` for a complete working example.

---

## Dependencies

```bash
npm install axios form-data
```

---

## API Behaviour

Both Foxit APIs follow the same async four-step pattern:

1. **Upload** — send the input file, receive a `documentId`
2. **Create task** — start processing, receive a `taskId`
3. **Poll** — check task status until `COMPLETED` or `FAILED` (120s timeout)
4. **Download** — retrieve the result using `resultDocumentId`

All polling, timeouts, and error decoding are handled automatically by the clients.

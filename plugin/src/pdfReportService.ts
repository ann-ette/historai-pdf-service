import fs from "fs";
import path from "path";
import { generatePdfFromHtml } from "./FoxitDocumentGenerationClient";
import { optimizePdf } from "./FoxitPdfServicesClient";

const TEMPLATE_PATH = path.join(__dirname, "..", "templates", "conversation-report.html");

export interface ThemeEntry {
  name: string;
  explanation: string;
  quote: string;
  context: string;
}

export interface ResourceEntry {
  topic: string;
  whyItMatters: string;
  whereToLearnMore: string;
}

export interface ReportData {
  characterName: string;
  characterTagline: string;
  characterBirthYear: string;
  characterDeathYear: string;
  characterBio: string;
  characterImageUrl: string;
  characterFacts: string[];
  sessionDate: string;
  sessionDuration: string;
  userName: string;
  sessionSummary: string;
  headlineInsight: string;
  themes: ThemeEntry[];
  resources: ResourceEntry[];
  reflectionQuestions: string[];
  mynerveFont: string;
}

function interpolate(template: string, data: Record<string, any>): string {
  let result = template.replace(
    /\{\{(\w+)\[(\d+)\]\.(\w+)\}\}/g,
    (_match, arrayName, index, field) => {
      const arr = data[arrayName];
      if (Array.isArray(arr) && arr[index] !== undefined) {
        return arr[index][field] !== undefined ? arr[index][field] : "";
      }
      return "";
    }
  );

  result = result.replace(
    /\{\{(\w+)\[(\d+)\]\}\}/g,
    (_match, arrayName, index) => {
      const arr = data[arrayName];
      if (Array.isArray(arr) && arr[index] !== undefined) {
        return arr[index];
      }
      return "";
    }
  );

  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return data[key] !== undefined ? data[key] : "";
  });

  return result;
}

export async function generateConversationReport(data: ReportData): Promise<Buffer> {
  let template: string;
  try {
    template = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  } catch (err: any) {
    throw new Error(`Failed to read HTML template: ${err.message}`);
  }

  const filledHtml = interpolate(template, data);
  console.log("[PdfReport] Template interpolated — starting pipeline");

  console.log("[PdfReport] Stage 1 → HTML → PDF (Foxit Document Generation API)");
  let initialPdf: Buffer;
  try {
    initialPdf = await generatePdfFromHtml(filledHtml);
  } catch (err: any) {
    throw new Error(`[PdfReport] Stage 1 failed: ${err.message}`);
  }

  console.log("[PdfReport] Stage 2 → Compress (Foxit PDF Services API)");
  let finalPdf: Buffer;
  try {
    finalPdf = await optimizePdf(initialPdf);
  } catch (err: any) {
    console.warn(`[PdfReport] Compression failed, returning uncompressed: ${err.message}`);
    finalPdf = initialPdf;
  }

  console.log(`[PdfReport] Pipeline complete — ${finalPdf.length} bytes`);
  return finalPdf;
}

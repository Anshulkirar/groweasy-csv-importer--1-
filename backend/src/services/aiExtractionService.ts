import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { CONFIG } from "../config/constants";
import { buildBatchPrompt, SYSTEM_PROMPT, IndexedRow } from "./promptBuilder";
import {
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
  CrmRecord,
  ImportResult,
  RawCsvRow,
  SkippedRecord,
  EMPTY_CRM_RECORD,
} from "../types/crm";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// --- Response validation -----------------------------------------------

const AiRowResultSchema = z.object({
  row_index: z.number(),
  skip: z.boolean(),
  skip_reason: z.string().optional(),
  created_at: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
  country_code: z.string().optional(),
  mobile_without_country_code: z.string().optional(),
  company: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  lead_owner: z.string().optional(),
  crm_status: z.string().optional(),
  crm_note: z.string().optional(),
  data_source: z.string().optional(),
  possession_time: z.string().optional(),
  description: z.string().optional(),
});

const AiBatchResponseSchema = z.array(AiRowResultSchema);

type AiRowResult = z.infer<typeof AiRowResultSchema>;

// --- Public API -----------------------------------------------------------

export interface ExtractionProgress {
  batchesTotal: number;
  batchesDone: number;
}

export async function extractCrmRecords(
  rows: RawCsvRow[],
  onProgress?: (p: ExtractionProgress) => void
): Promise<ImportResult> {
  const indexedRows: IndexedRow[] = rows.map((data, row_index) => ({ row_index, data }));
  const batches = chunk(indexedRows, CONFIG.BATCH_SIZE);

  const results: Map<number, AiRowResult> = new Map();
  let batchesDone = 0;

  await runWithConcurrency(batches, CONFIG.MAX_CONCURRENT_BATCHES, async (batch) => {
    const batchResults = await processBatchWithRetry(batch);
    for (const r of batchResults) {
      results.set(r.row_index, r);
    }
    batchesDone += 1;
    onProgress?.({ batchesTotal: batches.length, batchesDone });
  });

  const records: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];

  for (const row of indexedRows) {
    const result = results.get(row.row_index);

    if (!result) {
      skipped.push({
        rowIndex: row.row_index,
        raw: row.data,
        reason: "AI extraction failed for this row after multiple retries.",
      });
      continue;
    }

    if (result.skip) {
      skipped.push({
        rowIndex: row.row_index,
        raw: row.data,
        reason: result.skip_reason || "Row has no usable email or phone number.",
      });
      continue;
    }

    records.push(toCrmRecord(result));
  }

  return {
    records,
    skipped,
    totalImported: records.length,
    totalSkipped: skipped.length,
    totalRows: rows.length,
  };
}

// --- Batch processing -------------------------------------------------

async function processBatchWithRetry(batch: IndexedRow[]): Promise<AiRowResult[]> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      return await callAiForBatch(batch);
    } catch (err) {
      lastError = err;
      if (attempt < CONFIG.MAX_RETRIES) {
        await sleep(CONFIG.RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }

  console.error(
    `Batch starting at row ${batch[0]?.row_index} failed after ${CONFIG.MAX_RETRIES} attempts:`,
    lastError instanceof Error ? lastError.message : lastError
  );
  return [];
}

async function callAiForBatch(batch: IndexedRow[]): Promise<AiRowResult[]> {
  const model = genAI.getGenerativeModel({
    model: CONFIG.MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      maxOutputTokens: CONFIG.MAX_TOKENS_PER_BATCH,
      // Ask Gemini to return JSON directly
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(buildBatchPrompt(batch));
  const text = result.response.text();

  const parsed = parseJsonArray(text);
  const validated = AiBatchResponseSchema.safeParse(parsed);

  if (!validated.success) {
    throw new Error(`AI response failed schema validation: ${validated.error.message}`);
  }

  const expectedIndices = new Set(batch.map((r) => r.row_index));
  const gotIndices = new Set(validated.data.map((r) => r.row_index));
  const missing = [...expectedIndices].filter((i) => !gotIndices.has(i));
  if (missing.length > 0) {
    throw new Error(`AI response is missing ${missing.length} row(s) from this batch.`);
  }

  return validated.data;
}

function parseJsonArray(text: string): unknown {
  const trimmed = stripCodeFences(text.trim());
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start === -1 || end === -1 || end < start) {
      throw new Error("Could not locate a JSON array in the AI response.");
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function stripCodeFences(text: string): string {
  return text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
}

function toCrmRecord(result: AiRowResult): CrmRecord {
  const crm_status = isValidEnum(result.crm_status, CRM_STATUS_VALUES) ? result.crm_status : "";
  const data_source = isValidEnum(result.data_source, DATA_SOURCE_VALUES) ? result.data_source : "";

  return {
    ...EMPTY_CRM_RECORD,
    created_at: safeString(result.created_at),
    name: safeString(result.name),
    email: safeString(result.email),
    country_code: safeString(result.country_code),
    mobile_without_country_code: safeString(result.mobile_without_country_code),
    company: safeString(result.company),
    city: safeString(result.city),
    state: safeString(result.state),
    country: safeString(result.country),
    lead_owner: safeString(result.lead_owner),
    crm_status,
    crm_note: safeString(result.crm_note),
    data_source,
    possession_time: safeString(result.possession_time),
    description: safeString(result.description),
  };
}

function safeString(v: string | undefined): string {
  return (v ?? "").replace(/\r?\n/g, " | ").trim();
}

function isValidEnum<T extends readonly string[]>(
  value: string | undefined,
  allowed: T
): value is T[number] {
  return !!value && (allowed as readonly string[]).includes(value);
}

// --- Utilities ----------------------------------------------------------

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

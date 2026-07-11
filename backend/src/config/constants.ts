export const CONFIG = {
  /** Rows sent to the AI per request. Keeps prompts small and lets us parallelize + retry per-batch instead of re-running the whole file. */
  BATCH_SIZE: Number(process.env.AI_BATCH_SIZE ?? 25),
  /** How many batches run concurrently against the Anthropic API. */
  MAX_CONCURRENT_BATCHES: Number(process.env.AI_MAX_CONCURRENCY ?? 3),
  /** Retry attempts for a batch before giving up and marking its rows skipped. */
  MAX_RETRIES: Number(process.env.AI_MAX_RETRIES ?? 3),
  RETRY_BASE_DELAY_MS: 800,
  MODEL: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
  MAX_TOKENS_PER_BATCH: 8000,
  /** Hard cap on upload size to keep batching + AI cost predictable. */
  MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024, // 15 MB
  MAX_ROWS: 5000,
} as const;

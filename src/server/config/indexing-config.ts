import { env } from "~/env";

export const indexingConfig = {
  // Indexing behavior
  syncThreshold: parseInt(env.INDEXING_SYNC_THRESHOLD ?? "10", 10),
  timeoutPerUrl: parseInt(env.INDEXING_TIMEOUT_MS ?? "5000", 10),
  enableIndexing: env.ENABLE_CONTENT_INDEXING === "true",

  // Chunking
  chunkMaxTokens: 800,
  chunkOverlapTokens: 50,

  // Search
  rrfK: 60,
  candidatesPerSearch: 50,
} as const;

export type IndexingConfig = typeof indexingConfig;

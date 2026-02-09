import { env } from "~/env";

export const apiConfig = {
  ghost: {
    apiUrl: env.GHOST_API_URL,
    contentApiKey: env.GHOST_CONTENT_API_KEY,
    enabled: !!(env.GHOST_API_URL && env.GHOST_CONTENT_API_KEY),
  },
  contentful: {
    spaceId: env.CONTENTFUL_SPACE_ID,
    accessToken: env.CONTENTFUL_ACCESS_TOKEN,
    environment: env.CONTENTFUL_ENVIRONMENT ?? "master",
    enabled: !!(env.CONTENTFUL_SPACE_ID && env.CONTENTFUL_ACCESS_TOKEN),
  },
  youtube: {
    apiKey: env.YOUTUBE_API_KEY,
    channelId: env.YOUTUBE_CHANNEL_ID,
    enabled: !!env.YOUTUBE_API_KEY,
  },
  import: {
    batchSize: parseInt(env.API_IMPORT_BATCH_SIZE ?? "50", 10),
    delayMs: parseInt(env.API_IMPORT_DELAY_MS ?? "100", 10),
    chunkDelayMs: parseInt(env.API_IMPORT_CHUNK_DELAY_MS ?? "2000", 10),
  },
} as const;

export type ApiConfig = typeof apiConfig;

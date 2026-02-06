import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    AUTH_URL: z.string().url().optional(),
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    GOOGLE_HOSTED_DOMAIN: z.string().optional(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Content indexing
    INDEXING_SYNC_THRESHOLD: z.string().optional(),
    INDEXING_TIMEOUT_MS: z.string().optional(),
    ENABLE_CONTENT_INDEXING: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(), // Only needed for Full Content (AI) search
    // API integrations
    GHOST_API_URL: z.string().url().optional(),
    GHOST_CONTENT_API_KEY: z.string().optional(),
    CONTENTFUL_SPACE_ID: z.string().optional(),
    CONTENTFUL_ACCESS_TOKEN: z.string().optional(),
    CONTENTFUL_ENVIRONMENT: z.string().optional(),
    API_IMPORT_BATCH_SIZE: z.string().optional(),
    API_IMPORT_DELAY_MS: z.string().optional(),
    API_IMPORT_CHUNK_DELAY_MS: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_HOSTED_DOMAIN: process.env.GOOGLE_HOSTED_DOMAIN,
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    INDEXING_SYNC_THRESHOLD: process.env.INDEXING_SYNC_THRESHOLD,
    INDEXING_TIMEOUT_MS: process.env.INDEXING_TIMEOUT_MS,
    ENABLE_CONTENT_INDEXING: process.env.ENABLE_CONTENT_INDEXING,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GHOST_API_URL: process.env.GHOST_API_URL,
    GHOST_CONTENT_API_KEY: process.env.GHOST_CONTENT_API_KEY,
    CONTENTFUL_SPACE_ID: process.env.CONTENTFUL_SPACE_ID,
    CONTENTFUL_ACCESS_TOKEN: process.env.CONTENTFUL_ACCESS_TOKEN,
    CONTENTFUL_ENVIRONMENT: process.env.CONTENTFUL_ENVIRONMENT,
    API_IMPORT_BATCH_SIZE: process.env.API_IMPORT_BATCH_SIZE,
    API_IMPORT_DELAY_MS: process.env.API_IMPORT_DELAY_MS,
    API_IMPORT_CHUNK_DELAY_MS: process.env.API_IMPORT_CHUNK_DELAY_MS,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});

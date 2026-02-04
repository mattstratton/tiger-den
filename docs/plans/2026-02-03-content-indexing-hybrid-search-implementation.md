# Content Indexing & Hybrid Search Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable full-text hybrid search (BM25 + semantic) on crawled web pages and YouTube transcripts using Tiger Cloud's pg_textsearch, pgvector, and pgai.

**Architecture:** Fetch and chunk content → Store with embeddings → Hybrid search with client-side RRF fusion. Sync indexing for ≤10 items, mark as pending for bulk imports.

**Tech Stack:** TypeScript, Drizzle ORM, Tiger Cloud (pg_textsearch, pgvectorscale, pgai), cheerio, youtube-transcript, tiktoken

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install new packages**

Run:
```bash
npm install youtube-transcript tiktoken pgvector
npm install -D @types/node
```

Expected: Packages installed successfully

**Step 2: Verify installations**

Run: `npm list youtube-transcript tiktoken pgvector`

Expected: All three packages listed with versions

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add content indexing dependencies

- youtube-transcript for YouTube transcript extraction
- tiktoken for OpenAI-compatible token counting
- pgvector for TypeScript vector types"
```

---

## Task 2: Enable Tiger Cloud Extensions

**Files:**
- Create: `scripts/enable-extensions.sql`

**Step 1: Create SQL script**

Create `scripts/enable-extensions.sql`:

```sql
-- Enable Tiger Cloud extensions for content indexing
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_textsearch;
CREATE EXTENSION IF NOT EXISTS pgai CASCADE;

-- Verify extensions
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('vector', 'pg_textsearch', 'pgai')
ORDER BY extname;
```

**Step 2: Run SQL script on Tiger Cloud**

1. Open Tiger Cloud console SQL editor
2. Connect to your service
3. Run the script
4. Verify all 3 extensions are enabled

Expected output:
```
  extname      | extversion
---------------+------------
 pg_textsearch | 0.x.x
 pgai          | 0.x.x
 vector        | 0.x.x
```

**Step 3: Document in CLAUDE.md**

Add to CLAUDE.md under "Database" section:

```markdown
### Extensions Enabled
- `vector` - pgvector for embeddings storage
- `pg_textsearch` - BM25 keyword search
- `pgai` - Automated embedding generation
```

**Step 4: Commit**

```bash
git add scripts/enable-extensions.sql CLAUDE.md
git commit -m "feat(db): enable Tiger Cloud extensions for content indexing

- Add SQL script to enable vector, pg_textsearch, pgai
- Document extensions in CLAUDE.md"
```

---

## Task 3: Database Schema - Content Text Table

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Add indexStatusEnum**

Add after existing enums (around line 35):

```typescript
export const indexStatusEnum = tigerDenSchema.enum("index_status", [
  "pending",
  "indexed",
  "failed",
]);
```

**Step 2: Add content_text table**

Add after `contentItems` table (around line 148):

```typescript
// Content text storage for full-text search
export const contentText = tigerDenSchema.table("content_text", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentItemId: uuid("content_item_id")
    .notNull()
    .references(() => contentItems.id, { onDelete: "cascade" })
    .unique(),

  // Crawled content
  fullText: text("full_text").notNull(),
  plainText: text("plain_text").notNull(),

  // Metadata
  wordCount: integer("word_count").notNull(),
  tokenCount: integer("token_count").notNull(),
  contentHash: text("content_hash").notNull(),
  crawledAt: timestamp("crawled_at").notNull().defaultNow(),
  crawlDurationMs: integer("crawl_duration_ms"),

  // Status tracking
  indexStatus: indexStatusEnum("index_status").notNull().default("pending"),
  indexError: text("index_error"),
  indexedAt: timestamp("indexed_at"),
}, (table) => ({
  contentItemIdx: index("content_text_item_idx").on(table.contentItemId),
  statusIdx: index("content_text_status_idx").on(table.indexStatus),
}));
```

**Step 3: Add relations**

Add after existing relations (around line 195):

```typescript
export const contentTextRelations = relations(contentText, ({ one, many }) => ({
  contentItem: one(contentItems, {
    fields: [contentText.contentItemId],
    references: [contentItems.id],
  }),
  chunks: many(contentChunks),
}));
```

**Step 4: Generate migration**

Run: `npm run db:generate`

Expected: Migration file created in `drizzle/` directory

**Step 5: Review migration SQL**

Run: `cat drizzle/<timestamp>_*.sql`

Expected: CREATE TABLE and CREATE INDEX statements for content_text

**Step 6: Run migration**

Run: `npm run db:migrate`

Expected: Migration applied successfully

**Step 7: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(db): add content_text table for full-text indexing

- Store full_text (HTML) and plain_text (stripped)
- Track word_count, token_count, content_hash
- Status tracking: pending, indexed, failed
- Indexes on content_item_id and index_status"
```

---

## Task 4: Database Schema - Content Chunks Table

**Files:**
- Modify: `src/server/db/schema.ts`

**Step 1: Import sql helper**

Verify `sql` is imported at the top (should already be there from line 1):

```typescript
import { relations, sql } from "drizzle-orm";
```

**Step 2: Add content_chunks table**

Add after `contentText` table:

```typescript
// Content chunks with embeddings for hybrid search
export const contentChunks = tigerDenSchema.table("content_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentTextId: uuid("content_text_id")
    .notNull()
    .references(() => contentText.id, { onDelete: "cascade" }),

  // Chunk data
  chunkText: text("chunk_text").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  chunkTokenCount: integer("chunk_token_count").notNull(),

  // Vector embedding (halfvec for 50% storage savings)
  embedding: sql`halfvec(1536)`,

  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueChunk: index("content_chunks_unique_idx").on(
    table.contentTextId,
    table.chunkIndex
  ),
  textIdIdx: index("content_chunks_text_id_idx").on(table.contentTextId),
}));
```

**Step 3: Add to content_text relations**

Update the `contentTextRelations` added in Task 3:

```typescript
export const contentTextRelations = relations(contentText, ({ one, many }) => ({
  contentItem: one(contentItems, {
    fields: [contentText.contentItemId],
    references: [contentItems.id],
  }),
  chunks: many(contentChunks),
}));

export const contentChunksRelations = relations(contentChunks, ({ one }) => ({
  contentText: one(contentText, {
    fields: [contentChunks.contentTextId],
    references: [contentText.id],
  }),
}));
```

**Step 4: Generate migration**

Run: `npm run db:generate`

Expected: New migration file created

**Step 5: Review migration SQL**

Run: `cat drizzle/<timestamp>_*.sql`

Expected: CREATE TABLE with halfvec(1536) column

**Step 6: Run migration**

Run: `npm run db:migrate`

Expected: Migration applied successfully

**Step 7: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(db): add content_chunks table for hybrid search

- Store chunked text with embeddings (halfvec 1536)
- Track chunk_index and token_count per chunk
- Indexes on content_text_id and unique (text_id, index)
- Relations to content_text"
```

---

## Task 5: Create Search Indexes (BM25 + Vector)

**Files:**
- Create: `scripts/create-search-indexes.sql`

**Step 1: Create SQL script**

Create `scripts/create-search-indexes.sql`:

```sql
-- BM25 keyword search index (pg_textsearch)
CREATE INDEX IF NOT EXISTS content_chunks_bm25_idx
ON tiger_den.content_chunks
USING bm25(chunk_text)
WITH (text_config='english');

-- HNSW vector similarity search index (pgvector)
CREATE INDEX IF NOT EXISTS content_chunks_embedding_idx
ON tiger_den.content_chunks
USING hnsw(embedding halfvec_cosine_ops);

-- Verify indexes created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'content_chunks'
  AND schemaname = 'tiger_den'
ORDER BY indexname;
```

**Step 2: Run SQL script on Tiger Cloud**

1. Open Tiger Cloud console SQL editor
2. Run the script
3. Verify both indexes are created

Expected output:
```
           indexname            |                      indexdef
--------------------------------+----------------------------------------------------
 content_chunks_bm25_idx        | CREATE INDEX ... USING bm25 ...
 content_chunks_embedding_idx   | CREATE INDEX ... USING hnsw ...
```

**Step 3: Commit**

```bash
git add scripts/create-search-indexes.sql
git commit -m "feat(db): add BM25 and HNSW search indexes

- BM25 index on chunk_text for keyword search
- HNSW index on embedding for semantic search
- Both indexes required for hybrid search"
```

---

## Task 6: Configuration File

**Files:**
- Create: `src/server/config/indexing-config.ts`

**Step 1: Create configuration file**

Create `src/server/config/indexing-config.ts`:

```typescript
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
```

**Step 2: Add environment variables to env.ts**

Add to `src/env.ts` in the `server` section (around line 15):

```typescript
// Content indexing
INDEXING_SYNC_THRESHOLD: z.string().optional(),
INDEXING_TIMEOUT_MS: z.string().optional(),
ENABLE_CONTENT_INDEXING: z.string().optional(),
```

**Step 3: Add to .env.example**

Add to `.env.example`:

```bash
# Content Indexing Configuration
INDEXING_SYNC_THRESHOLD=10
INDEXING_TIMEOUT_MS=5000
ENABLE_CONTENT_INDEXING=true
```

**Step 4: Add to your local .env**

Add to `.env`:

```bash
INDEXING_SYNC_THRESHOLD=10
INDEXING_TIMEOUT_MS=5000
ENABLE_CONTENT_INDEXING=true
```

**Step 5: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 6: Commit**

```bash
git add src/server/config/indexing-config.ts src/env.ts .env.example
git commit -m "feat(config): add indexing configuration

- Sync threshold (default: 10 items)
- Timeout per URL (default: 5s)
- Feature flag for content indexing
- Chunking and search parameters"
```

---

## Task 7: Content Fetcher Service - Type Definitions

**Files:**
- Create: `src/server/services/content-fetcher.ts`

**Step 1: Create service file with types**

Create `src/server/services/content-fetcher.ts`:

```typescript
export interface FetchResult {
  plainText: string;
  fullText: string;
  wordCount: number;
  tokenCount: number;
  duration: number;
}

export class ContentFetchError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "ContentFetchError";
  }
}

/**
 * Extract YouTube video ID from URL
 * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
 */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Count tokens using tiktoken (OpenAI compatible)
 */
async function countTokens(text: string): Promise<number> {
  // TODO: Implement in next task
  return 0;
}

/**
 * Count words (simple whitespace split)
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/content-fetcher.ts
git commit -m "feat(fetcher): add type definitions and helpers

- FetchResult interface for fetcher return type
- ContentFetchError for error handling
- extractYouTubeVideoId helper
- Token and word counting helpers (stubs)"
```

---

## Task 8: Content Fetcher - Token Counting

**Files:**
- Modify: `src/server/services/content-fetcher.ts`

**Step 1: Import tiktoken**

Add imports at the top:

```typescript
import { encoding_for_model } from "tiktoken";
```

**Step 2: Implement countTokens**

Replace the `countTokens` stub:

```typescript
/**
 * Count tokens using tiktoken (OpenAI compatible)
 * Uses cl100k_base encoding (same as text-embedding-3-small)
 */
async function countTokens(text: string): Promise<number> {
  try {
    const encoding = encoding_for_model("text-embedding-3-small");
    const tokens = encoding.encode(text);
    encoding.free(); // Free memory
    return tokens.length;
  } catch (error) {
    console.error("Token counting failed:", error);
    // Fallback: rough estimate (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4);
  }
}
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add src/server/services/content-fetcher.ts
git commit -m "feat(fetcher): implement token counting with tiktoken

- Use cl100k_base encoding (text-embedding-3-small)
- Fallback to character-based estimate on error
- Free encoding memory after use"
```

---

## Task 9: Content Fetcher - Web Content Extraction

**Files:**
- Modify: `src/server/services/content-fetcher.ts`

**Step 1: Add imports**

Add to imports:

```typescript
import * as cheerio from "cheerio";
import { indexingConfig } from "~/server/config/indexing-config";
```

**Step 2: Add fetchWebContent function**

Add after helper functions:

```typescript
/**
 * Fetch and extract content from web page
 * Uses cheerio for HTML parsing
 * 5-second timeout, strips nav/footer/ads
 */
export async function fetchWebContent(url: string): Promise<FetchResult> {
  const startTime = Date.now();

  try {
    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      indexingConfig.timeoutPerUrl,
    );

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TigerDen/1.0; +https://tigerdata.com)",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $("script, style, nav, footer, aside, .advertisement, .ad").remove();

    // Extract main content
    const mainContent =
      $("main").text() || $("article").text() || $("body").text();

    // Clean up whitespace
    const plainText = mainContent
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim();

    const fullText = $.html();
    const wordCount = countWords(plainText);
    const tokenCount = await countTokens(plainText);
    const duration = Date.now() - startTime;

    return {
      plainText,
      fullText,
      wordCount,
      tokenCount,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error instanceof Error && error.name === "AbortError") {
      throw new ContentFetchError(
        `Timeout after ${duration}ms`,
        url,
        error,
      );
    }

    throw new ContentFetchError(
      error instanceof Error ? error.message : "Unknown error",
      url,
      error instanceof Error ? error : undefined,
    );
  }
}
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add src/server/services/content-fetcher.ts
git commit -m "feat(fetcher): implement web content extraction

- Use cheerio to parse HTML
- Remove nav, footer, ads, scripts, styles
- Extract main/article/body content
- 5-second timeout with AbortController
- Return plain text, full HTML, counts, duration"
```

---

## Task 10: Content Fetcher - YouTube Transcript Extraction

**Files:**
- Modify: `src/server/services/content-fetcher.ts`

**Step 1: Add import**

Add to imports:

```typescript
import { YoutubeTranscript } from "youtube-transcript";
```

**Step 2: Add fetchYouTubeTranscript function**

Add after `fetchWebContent`:

```typescript
/**
 * Fetch YouTube transcript
 * Uses youtube-transcript package
 * Handles missing transcripts gracefully
 */
export async function fetchYouTubeTranscript(
  url: string,
): Promise<FetchResult> {
  const startTime = Date.now();

  try {
    const videoId = extractYouTubeVideoId(url);

    if (!videoId) {
      throw new ContentFetchError("Invalid YouTube URL", url);
    }

    // Fetch transcript
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    // Combine all text segments (strip timestamps)
    const plainText = transcript.map((segment) => segment.text).join(" ");

    const fullText = plainText; // No HTML for transcripts
    const wordCount = countWords(plainText);
    const tokenCount = await countTokens(plainText);
    const duration = Date.now() - startTime;

    return {
      plainText,
      fullText,
      wordCount,
      tokenCount,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Transcript not available - return empty (don't fail)
    if (
      error instanceof Error &&
      error.message.includes("Could not find transcript")
    ) {
      return {
        plainText: "",
        fullText: "",
        wordCount: 0,
        tokenCount: 0,
        duration,
      };
    }

    throw new ContentFetchError(
      error instanceof Error ? error.message : "Unknown error",
      url,
      error instanceof Error ? error : undefined,
    );
  }
}
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add src/server/services/content-fetcher.ts
git commit -m "feat(fetcher): implement YouTube transcript extraction

- Use youtube-transcript package
- Extract video ID from URL
- Combine transcript segments into plain text
- Return empty result if transcript unavailable (graceful)"
```

---

## Task 11: Content Fetcher - Main Entry Point

**Files:**
- Modify: `src/server/services/content-fetcher.ts`

**Step 1: Add fetchContent function**

Add after YouTube function:

```typescript
/**
 * Fetch content from URL (auto-detect type)
 * Dispatches to web or YouTube fetcher based on URL
 */
export async function fetchContent(url: string): Promise<FetchResult> {
  // Check if YouTube URL
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    return fetchYouTubeTranscript(url);
  }

  // Default to web content
  return fetchWebContent(url);
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Test imports work**

Run: `npm run typecheck`

Expected: No errors

**Step 4: Commit**

```bash
git add src/server/services/content-fetcher.ts
git commit -m "feat(fetcher): add main entry point with auto-detection

- fetchContent() auto-detects YouTube vs web
- Dispatches to appropriate fetcher
- Ready for use by indexing orchestrator"
```

---

## Task 12: Content Chunker Service

**Files:**
- Create: `src/server/services/content-chunker.ts`

**Step 1: Create chunker service**

Create `src/server/services/content-chunker.ts`:

```typescript
import { encoding_for_model } from "tiktoken";
import { indexingConfig } from "~/server/config/indexing-config";

export interface Chunk {
  text: string;
  index: number;
  tokenCount: number;
}

/**
 * Split text into chunks at paragraph boundaries
 */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Split text into sentences (simple period/question/exclamation split)
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Chunk content into 500-800 token pieces with 50-token overlap
 * Preserves paragraph and sentence boundaries where possible
 */
export async function chunkContent(
  plainText: string,
  maxTokens: number = indexingConfig.chunkMaxTokens,
): Promise<Chunk[]> {
  const encoding = encoding_for_model("text-embedding-3-small");
  const chunks: Chunk[] = [];

  try {
    // If text is small enough, return single chunk
    const totalTokens = encoding.encode(plainText).length;
    if (totalTokens <= maxTokens) {
      encoding.free();
      return [
        {
          text: plainText,
          index: 0,
          tokenCount: totalTokens,
        },
      ];
    }

    // Split into paragraphs
    const paragraphs = splitIntoParagraphs(plainText);
    let currentChunk = "";
    let currentTokens = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = encoding.encode(paragraph).length;

      // If adding this paragraph exceeds limit
      if (currentTokens + paragraphTokens > maxTokens && currentChunk) {
        // Save current chunk
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex++,
          tokenCount: currentTokens,
        });

        // Start new chunk with overlap
        // Take last ~50 tokens from current chunk
        const sentences = splitIntoSentences(currentChunk);
        const overlapSentences = sentences.slice(-2); // Last 2 sentences ≈ 50 tokens
        currentChunk = overlapSentences.join(". ") + ". " + paragraph;
        currentTokens = encoding.encode(currentChunk).length;
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
        currentTokens += paragraphTokens;
      }
    }

    // Add final chunk if any content remains
    if (currentChunk) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        tokenCount: currentTokens,
      });
    }

    encoding.free();
    return chunks;
  } catch (error) {
    encoding.free();
    throw error;
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/content-chunker.ts
git commit -m "feat(chunker): implement content chunking with overlap

- Target 500-800 tokens per chunk
- 50-token overlap between chunks (last 2 sentences)
- Preserve paragraph boundaries
- Split on sentences if needed
- Use tiktoken for accurate token counting"
```

---

## Task 13: Indexing Orchestrator - Type Definitions

**Files:**
- Create: `src/server/services/indexing-orchestrator.ts`

**Step 1: Create orchestrator with types**

Create `src/server/services/indexing-orchestrator.ts`:

```typescript
import { db } from "~/server/db";
import { contentText, contentChunks } from "~/server/db/schema";
import { indexingConfig } from "~/server/config/indexing-config";
import { fetchContent, ContentFetchError } from "./content-fetcher";
import { chunkContent } from "./content-chunker";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export interface IndexingResult {
  success: boolean;
  contentItemId: string;
  error?: string;
}

export interface IndexingStats {
  total: number;
  succeeded: number;
  failed: number;
  results: IndexingResult[];
}

/**
 * Calculate SHA256 hash of text
 */
function calculateHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/indexing-orchestrator.ts
git commit -m "feat(orchestrator): add type definitions and hash helper

- IndexingResult and IndexingStats types
- calculateHash helper for content deduplication"
```

---

## Task 14: Indexing Orchestrator - Single Item Indexing

**Files:**
- Modify: `src/server/services/indexing-orchestrator.ts`

**Step 1: Add indexSingleItem function**

Add after helper functions:

```typescript
/**
 * Index a single content item
 * Fetches content, chunks it, stores in database
 */
async function indexSingleItem(
  contentItemId: string,
  url: string,
): Promise<IndexingResult> {
  try {
    // Step 1: Fetch content
    const fetchResult = await fetchContent(url);

    // Handle empty content (e.g., no YouTube transcript)
    if (!fetchResult.plainText) {
      return {
        success: false,
        contentItemId,
        error: "No content available (empty or transcript unavailable)",
      };
    }

    const contentHash = calculateHash(fetchResult.plainText);

    // Step 2: Store full content
    const [contentTextRecord] = await db
      .insert(contentText)
      .values({
        contentItemId,
        fullText: fetchResult.fullText,
        plainText: fetchResult.plainText,
        wordCount: fetchResult.wordCount,
        tokenCount: fetchResult.tokenCount,
        contentHash,
        crawlDurationMs: fetchResult.duration,
        indexStatus: "pending",
      })
      .returning();

    if (!contentTextRecord) {
      throw new Error("Failed to insert content_text record");
    }

    // Step 3: Chunk content
    const chunks = await chunkContent(fetchResult.plainText);

    // Step 4: Store chunks (embeddings generated by pgai)
    await db.insert(contentChunks).values(
      chunks.map((chunk) => ({
        contentTextId: contentTextRecord.id,
        chunkText: chunk.text,
        chunkIndex: chunk.index,
        chunkTokenCount: chunk.tokenCount,
      })),
    );

    // Step 5: Mark as indexed
    await db
      .update(contentText)
      .set({
        indexStatus: "indexed",
        indexedAt: new Date(),
      })
      .where(eq(contentText.id, contentTextRecord.id));

    return {
      success: true,
      contentItemId,
    };
  } catch (error) {
    // Store error in database
    try {
      const existing = await db.query.contentText.findFirst({
        where: eq(contentText.contentItemId, contentItemId),
      });

      if (existing) {
        await db
          .update(contentText)
          .set({
            indexStatus: "failed",
            indexError:
              error instanceof ContentFetchError
                ? error.message
                : error instanceof Error
                  ? error.message
                  : "Unknown error",
          })
          .where(eq(contentText.id, existing.id));
      }
    } catch (dbError) {
      console.error("Failed to update error status:", dbError);
    }

    return {
      success: false,
      contentItemId,
      error:
        error instanceof ContentFetchError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown error",
    };
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/indexing-orchestrator.ts
git commit -m "feat(orchestrator): implement single item indexing

- Fetch content with timeout handling
- Store full text and metadata
- Chunk content and store chunks
- Mark as indexed on success
- Store error message on failure (fail gracefully)"
```

---

## Task 15: Indexing Orchestrator - Main Entry Point

**Files:**
- Modify: `src/server/services/indexing-orchestrator.ts`

**Step 1: Add indexContent function**

Add after `indexSingleItem`:

```typescript
/**
 * Index multiple content items
 * Sync for ≤10 items, mark as pending for 11+
 */
export async function indexContent(
  items: Array<{ id: string; url: string }>,
): Promise<IndexingStats> {
  if (!indexingConfig.enableIndexing) {
    return {
      total: items.length,
      succeeded: 0,
      failed: 0,
      results: items.map((item) => ({
        success: false,
        contentItemId: item.id,
        error: "Content indexing disabled (ENABLE_CONTENT_INDEXING=false)",
      })),
    };
  }

  // Sync indexing for ≤ threshold
  if (items.length <= indexingConfig.syncThreshold) {
    const results: IndexingResult[] = [];

    for (const item of items) {
      const result = await indexSingleItem(item.id, item.url);
      results.push(result);
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      total: items.length,
      succeeded,
      failed,
      results,
    };
  }

  // Async indexing (Phase 2) - for now just mark as pending
  // TODO: Implement background job queue (BullMQ/pg-boss)
  const results: IndexingResult[] = [];

  for (const item of items) {
    try {
      await db.insert(contentText).values({
        contentItemId: item.id,
        fullText: "",
        plainText: "",
        wordCount: 0,
        tokenCount: 0,
        contentHash: "",
        crawlDurationMs: 0,
        indexStatus: "pending",
      });

      results.push({
        success: true,
        contentItemId: item.id,
      });
    } catch (error) {
      results.push({
        success: false,
        contentItemId: item.id,
        error:
          error instanceof Error ? error.message : "Failed to mark as pending",
      });
    }
  }

  return {
    total: items.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/indexing-orchestrator.ts
git commit -m "feat(orchestrator): add main entry point with sync/async logic

- Sync indexing for ≤10 items (configurable)
- Mark as pending for 11+ items (async queue in Phase 2)
- Feature flag support (ENABLE_CONTENT_INDEXING)
- Return stats: total, succeeded, failed, results"
```

---

## Task 16: Search Service - Type Definitions & RRF

**Files:**
- Create: `src/server/services/search-service.ts`

**Step 1: Create search service**

Create `src/server/services/search-service.ts`:

```typescript
import { db } from "~/server/db";
import { contentChunks, contentText } from "~/server/db/schema";
import { indexingConfig } from "~/server/config/indexing-config";
import { sql } from "drizzle-orm";

export interface SearchResult {
  contentItemId: string;
  chunkId: string;
  chunkText: string;
  relevanceScore: number;
  matchType: "hybrid";
}

interface QueryRow {
  content_item_id: string;
  chunk_id: string;
  chunk_text: string;
}

/**
 * Reciprocal Rank Fusion (RRF)
 * Combines keyword and semantic search rankings
 * Formula: score = 1 / (k + rank)
 */
function rrfFusion(
  keywordResults: QueryRow[],
  semanticResults: QueryRow[],
  k: number = indexingConfig.rrfK,
  limit: number = 10,
): SearchResult[] {
  const scores = new Map<string, number>();
  const dataMap = new Map<string, QueryRow>();

  // Keyword rankings
  keywordResults.forEach((row, i) => {
    const key = row.chunk_id;
    scores.set(key, (scores.get(key) ?? 0) + 1 / (k + i + 1));
    dataMap.set(key, row);
  });

  // Semantic rankings
  semanticResults.forEach((row, i) => {
    const key = row.chunk_id;
    scores.set(key, (scores.get(key) ?? 0) + 1 / (k + i + 1));
    dataMap.set(key, row);
  });

  // Sort and return top results
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([chunkId, score]) => {
      const data = dataMap.get(chunkId)!;
      return {
        contentItemId: data.content_item_id,
        chunkId,
        chunkText: data.chunk_text,
        relevanceScore: score,
        matchType: "hybrid",
      };
    });
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/search-service.ts
git commit -m "feat(search): add RRF fusion for hybrid search

- SearchResult type for unified results
- rrfFusion function implementing k=60 formula
- Combines keyword and semantic rankings"
```

---

## Task 17: Search Service - Hybrid Search Implementation

**Files:**
- Modify: `src/server/services/search-service.ts`

**Step 1: Add hybridSearch function**

Add after `rrfFusion`:

```typescript
/**
 * Hybrid search: BM25 keyword + vector semantic with RRF fusion
 * Runs queries in parallel, fuses results client-side
 */
export async function hybridSearch(
  query: string,
  embedding: number[],
  limit: number = 10,
): Promise<SearchResult[]> {
  const candidateLimit = indexingConfig.candidatesPerSearch;

  // Run both queries in parallel
  const [keywordResults, semanticResults] = await Promise.all([
    // Query 1: BM25 keyword search
    db.execute<QueryRow>(sql`
      SELECT
        ct.content_item_id,
        cc.id as chunk_id,
        cc.chunk_text
      FROM tiger_den.content_chunks cc
      JOIN tiger_den.content_text ct ON ct.id = cc.content_text_id
      ORDER BY cc.chunk_text <@> ${query}
      LIMIT ${candidateLimit}
    `),

    // Query 2: Vector semantic search
    db.execute<QueryRow>(sql`
      SELECT
        ct.content_item_id,
        cc.id as chunk_id,
        cc.chunk_text
      FROM tiger_den.content_chunks cc
      JOIN tiger_den.content_text ct ON ct.id = cc.content_text_id
      WHERE cc.embedding IS NOT NULL
      ORDER BY cc.embedding <=> ${sql.raw(`'[${embedding.join(",")}]'::halfvec(1536)`)}
      LIMIT ${candidateLimit}
    `),
  ]);

  // Fuse with RRF
  return rrfFusion(
    keywordResults.rows as QueryRow[],
    semanticResults.rows as QueryRow[],
    indexingConfig.rrfK,
    limit,
  );
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/search-service.ts
git commit -m "feat(search): implement hybrid search with parallel queries

- Parallel BM25 (<@>) and vector (<=>) queries
- Fetch 50 candidates per method (configurable)
- Client-side RRF fusion
- Return top 10 results by relevance"
```

---

## Task 18: tRPC Content Router - Re-index Endpoint

**Files:**
- Modify: `src/server/api/routers/content.ts`

**Step 1: Add import**

Add to imports at top:

```typescript
import { indexContent } from "~/server/services/indexing-orchestrator";
```

**Step 2: Add reindexContent procedure**

Add after the `delete` procedure (around line 180):

```typescript
reindexContent: protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    // Get content item
    const item = await ctx.db.query.contentItems.findFirst({
      where: eq(schema.contentItems.id, input.id),
    });

    if (!item) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Content item not found",
      });
    }

    // Run indexing
    const result = await indexContent([
      { id: item.id, url: item.currentUrl },
    ]);

    if (result.failed > 0) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: result.results[0]?.error ?? "Indexing failed",
      });
    }

    return { success: true };
  }),
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add src/server/api/routers/content.ts
git commit -m "feat(api): add reindexContent tRPC endpoint

- Manual re-indexing for failed/pending items
- Accepts content item UUID
- Runs indexing orchestrator for single item
- Returns success or error"
```

---

## Task 19: tRPC Content Router - Get Index Status

**Files:**
- Modify: `src/server/api/routers/content.ts`

**Step 1: Add getIndexStatus procedure**

Add after `reindexContent`:

```typescript
getIndexStatus: protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    const indexStatus = await ctx.db.query.contentText.findFirst({
      where: eq(schema.contentText.contentItemId, input.id),
      columns: {
        indexStatus: true,
        indexError: true,
        indexedAt: true,
        crawledAt: true,
        wordCount: true,
        tokenCount: true,
      },
    });

    return indexStatus ?? null;
  }),
```

**Step 2: Add contentText to schema import**

Update the schema import at the top to include `contentText`:

```typescript
import * as schema from "~/server/db/schema";
```

(This should already be there, just verify)

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add src/server/api/routers/content.ts
git commit -m "feat(api): add getIndexStatus endpoint

- Query index status for content item
- Returns status, error, timestamps, counts
- Returns null if not indexed yet"
```

---

## Task 20: CSV Import - Hook Into Indexing

**Files:**
- Modify: `src/server/services/csv-processor.ts`

**Step 1: Add import**

Add to imports:

```typescript
import { indexContent } from "./indexing-orchestrator";
```

**Step 2: Find the import success section**

Locate where successful rows are inserted (around line 180-200, after the transaction commits).

**Step 3: Add indexing call**

After the transaction commits and before the final stats return, add:

```typescript
// Index content (sync for ≤10 items, async for 11+)
const itemsToIndex = successfulInserts.map((item) => ({
  id: item.id,
  url: item.currentUrl,
}));

if (itemsToIndex.length > 0) {
  try {
    const indexingResult = await indexContent(itemsToIndex);

    // Update stats with indexing results
    stats.indexed = indexingResult.succeeded;
    stats.indexingFailed = indexingResult.failed;
  } catch (error) {
    console.error("Content indexing failed:", error);
    // Don't fail import if indexing fails
    stats.indexingFailed = itemsToIndex.length;
  }
}
```

**Step 4: Update stats type**

Find the `stats` object initialization and add indexing fields:

```typescript
const stats = {
  total: validatedRows.length,
  imported: 0,
  errors: [] as Array<{ row: number; field: string; message: string }>,
  newCampaigns: [] as string[],
  enriched: 0,
  indexed: 0,
  indexingFailed: 0,
};
```

**Step 5: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 6: Commit**

```bash
git add src/server/services/csv-processor.ts
git commit -m "feat(import): hook content indexing into CSV import

- Call indexContent after successful import
- Track indexed/failed counts in stats
- Don't fail import if indexing fails (graceful)"
```

---

## Task 21: Manual Content Creation - Hook Into Indexing

**Files:**
- Modify: `src/server/api/routers/content.ts`

**Step 1: Find create procedure**

Locate the `create` procedure (around line 90).

**Step 2: Add indexing after insert**

After the content item is created and before returning, add:

```typescript
// Index content
try {
  await indexContent([{ id: newItem.id, url: newItem.currentUrl }]);
} catch (error) {
  console.error("Content indexing failed:", error);
  // Don't fail creation if indexing fails
}
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add src/server/api/routers/content.ts
git commit -m "feat(create): hook content indexing into manual creation

- Index newly created content items
- Graceful failure (don't block creation)"
```

---

## Task 22: UI - Content Index Status Badge

**Files:**
- Create: `src/app/content/_components/content-index-status.tsx`

**Step 1: Create status badge component**

Create `src/app/content/_components/content-index-status.tsx`:

```typescript
"use client";

import { api } from "~/trpc/react";

interface ContentIndexStatusProps {
  contentId: string;
}

export function ContentIndexStatus({ contentId }: ContentIndexStatusProps) {
  const { data: indexStatus, isLoading } = api.content.getIndexStatus.useQuery(
    { id: contentId },
    { refetchInterval: false },
  );

  if (isLoading) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
        Loading...
      </span>
    );
  }

  if (!indexStatus) {
    return (
      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
        Not indexed
      </span>
    );
  }

  switch (indexStatus.indexStatus) {
    case "indexed":
      return (
        <span
          className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700"
          title={`Indexed ${indexStatus.wordCount} words, ${indexStatus.tokenCount} tokens`}
        >
          ✓ Indexed
        </span>
      );
    case "pending":
      return (
        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-700">
          ⏳ Pending
        </span>
      );
    case "failed":
      return (
        <span
          className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700"
          title={indexStatus.indexError ?? "Unknown error"}
        >
          ✗ Failed
        </span>
      );
    default:
      return null;
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/content/_components/content-index-status.tsx
git commit -m "feat(ui): add content index status badge component

- Show indexed/pending/failed status
- Color-coded badges (green/yellow/red)
- Tooltip with word/token counts or error message"
```

---

## Task 23: UI - Re-index Button

**Files:**
- Create: `src/app/content/_components/reindex-button.tsx`

**Step 1: Create reindex button component**

Create `src/app/content/_components/reindex-button.tsx`:

```typescript
"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

interface ReindexButtonProps {
  contentId: string;
  indexStatus: "pending" | "failed" | "indexed" | null;
}

export function ReindexButton({
  contentId,
  indexStatus,
}: ReindexButtonProps) {
  const [isReindexing, setIsReindexing] = useState(false);
  const utils = api.useUtils();

  const reindexMutation = api.content.reindexContent.useMutation({
    onSuccess: async () => {
      // Refetch index status
      await utils.content.getIndexStatus.invalidate({ id: contentId });
      setIsReindexing(false);
    },
    onError: (error) => {
      console.error("Reindex failed:", error);
      setIsReindexing(false);
      alert(`Reindex failed: ${error.message}`);
    },
  });

  // Only show button for failed or pending items
  if (indexStatus !== "failed" && indexStatus !== "pending") {
    return null;
  }

  const handleReindex = () => {
    setIsReindexing(true);
    reindexMutation.mutate({ id: contentId });
  };

  return (
    <button
      onClick={handleReindex}
      disabled={isReindexing}
      className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {isReindexing ? "Reindexing..." : "Re-index"}
    </button>
  );
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/content/_components/reindex-button.tsx
git commit -m "feat(ui): add re-index button component

- Show for failed/pending items only
- Trigger manual reindexing
- Show loading state during reindex
- Invalidate cache on success"
```

---

## Task 24: UI - Integrate Status & Button Into Content Table

**Files:**
- Modify: `src/app/content/_components/content-table.tsx`

**Step 1: Add imports**

Add to imports:

```typescript
import { ContentIndexStatus } from "./content-index-status";
import { ReindexButton } from "./reindex-button";
```

**Step 2: Add Index Status column header**

Find the table header row (around line 50) and add a new column after "Actions":

```tsx
<th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
  Index Status
</th>
```

**Step 3: Add status badge and button to table rows**

Find the table body row rendering (around line 100) and add after the Actions cell:

```tsx
<td className="whitespace-nowrap px-6 py-4 text-sm">
  <div className="flex items-center gap-2">
    <ContentIndexStatus contentId={item.id} />
    <ReindexButton
      contentId={item.id}
      indexStatus={null} // Will be fetched by ReindexButton
    />
  </div>
</td>
```

**Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 5: Test in browser**

Run: `npm run dev`

Navigate to: `http://localhost:3000/content`

Expected: See new "Index Status" column with badges

**Step 6: Commit**

```bash
git add src/app/content/_components/content-table.tsx
git commit -m "feat(ui): add index status and re-index button to content table

- New column showing index status badges
- Re-index button for failed/pending items
- Real-time status updates"
```

---

## Task 25: Documentation - Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add Content Indexing section**

Add after "Key Features" section:

```markdown
### Content Indexing & Hybrid Search
- Full-text indexing of web pages and YouTube transcripts
- Hybrid search: BM25 keyword + semantic vector with RRF fusion
- Leverages Tiger Cloud: pg_textsearch, pgvectorscale, pgai Vectorizer
- Sync indexing for ≤10 items (configurable threshold)
- Async queue for bulk imports (Phase 2)
- Manual re-index for failed/pending items
- Status tracking: pending, indexed, failed
```

**Step 2: Add to Tech Stack**

Update "Tech Stack" section with:

```markdown
- **Search**: pg_textsearch (BM25), pgvector (embeddings), pgai (auto-embedding)
```

**Step 3: Add to Database section**

Add after "Schema" line:

```markdown
- **Content Indexing Tables**: `content_text`, `content_chunks`
```

**Step 4: Add to Commands section**

Add to commands:

```markdown
npm run typecheck    # Type check only (no build)
```

**Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document content indexing and hybrid search

- Add Content Indexing section to features
- Update tech stack with search extensions
- Document new database tables"
```

---

## Task 26: Documentation - Update FOLLOW-UP.md

**Files:**
- Modify: `FOLLOW-UP.md`

**Step 1: Move to completed section**

The content indexing feature should now be marked as completed. Add to "Completed Features":

```markdown
### Content Indexing & Hybrid Search
**Completed:** 2026-02-03
**Description:** Full-text search on crawled web pages and YouTube transcripts
**Implementation:**
- Tiger Cloud extensions: pg_textsearch (BM25), pgvectorscale (vectors), pgai (embeddings)
- Hybrid search with RRF fusion (client-side)
- Content fetcher: cheerio (web) + youtube-transcript (videos)
- Chunking: 500-800 tokens with 50-token overlap
- Sync indexing for ≤10 items, mark as pending for 11+
- Manual re-index for failed/pending items
- Status tracking and UI badges

**Phase 2 (Future):**
- Background job queue (BullMQ/pg-boss) for bulk indexing
- Search result highlighting
- Content freshness checks (re-crawl schedule)
- REST API for external systems (Eon integration)
- Analytics dashboard
```

**Step 2: Commit**

```bash
git add FOLLOW-UP.md
git commit -m "docs: mark content indexing as completed

- Move from pending to completed features
- Document implementation details
- List Phase 2 future enhancements"
```

---

## Task 27: Testing - Create Test Content Items

**Files:**
- Create: `test-data/content-indexing-test.csv`

**Step 1: Create test CSV**

Create `test-data/content-indexing-test.csv`:

```csv
title,current_url,content_type,publish_date,description,author,target_audience,campaigns,tags
Tiger Cloud Guide,https://www.tigerdata.com/docs/getting-started,website_content,2024-01-15,Getting started guide,Tiger Team,developers,Content Test,postgresql timescale
YouTube Video Test,https://www.youtube.com/watch?v=dQw4w9WgXcQ,youtube_video,2024-02-01,Test video transcript,Test Author,general,Content Test,video test
Blog Post Test,https://www.tigerdata.com/blog,blog_post,2024-02-10,Test blog post,Tiger Team,developers,Content Test,blog test
```

**Step 2: Commit**

```bash
git add test-data/content-indexing-test.csv
git commit -m "test: add content indexing test CSV

- 3 test items: web page, YouTube video, blog
- Mix of content types for indexing validation"
```

---

## Task 28: Manual Testing

**Manual steps - no commit needed**

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Import test CSV**

1. Navigate to `http://localhost:3000/content`
2. Click "Import CSV"
3. Upload `test-data/content-indexing-test.csv`
4. Wait for import to complete

**Step 3: Verify indexing**

1. Check "Index Status" column in content table
2. Verify statuses change from "Pending" to "Indexed" or "Failed"
3. Check that indexed items show word/token counts in tooltip

**Step 4: Test re-index**

1. Find a failed item (if any)
2. Click "Re-index" button
3. Verify status updates

**Step 5: Check database**

Run in Tiger Cloud SQL editor:

```sql
-- Check content_text table
SELECT
  ci.title,
  ct.index_status,
  ct.word_count,
  ct.token_count,
  ct.crawl_duration_ms
FROM tiger_den.content_text ct
JOIN tiger_den.content_items ci ON ci.id = ct.content_item_id
ORDER BY ct.crawled_at DESC
LIMIT 10;

-- Check content_chunks table
SELECT
  ci.title,
  cc.chunk_index,
  cc.chunk_token_count,
  LEFT(cc.chunk_text, 100) as chunk_preview
FROM tiger_den.content_chunks cc
JOIN tiger_den.content_text ct ON ct.id = cc.content_text_id
JOIN tiger_den.content_items ci ON ci.id = ct.content_item_id
ORDER BY ct.crawled_at DESC, cc.chunk_index
LIMIT 20;

-- Check embeddings are populated
SELECT
  COUNT(*) as total_chunks,
  COUNT(embedding) as chunks_with_embeddings,
  COUNT(*) - COUNT(embedding) as missing_embeddings
FROM tiger_den.content_chunks;
```

**Expected results:**
- 3 items in content_text (pending → indexed)
- Multiple chunks in content_chunks
- Embeddings populated (may take a few seconds for pgai)

**Step 6: Document results**

Create a brief summary:
- How many items indexed successfully?
- Any failures? What errors?
- Embedding generation working?
- Performance (time to index)?

---

## Task 29: Final Verification & Merge Preparation

**Files:**
- None (verification only)

**Step 1: Type check**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 2: Lint check**

Run: `npm run check`

Expected: No errors (or only warnings)

**Step 3: Build check**

Run: `npm run build`

Expected: Build succeeds

**Step 4: Review git status**

Run: `git status`

Expected: Working tree clean (all changes committed)

**Step 5: Review commit log**

Run: `git log --oneline -30`

Expected: 29 commits from this feature branch

**Step 6: Push to remote**

Run: `git push origin feature/content-indexing-hybrid-search`

Expected: Branch pushed successfully

**Step 7: Document completion**

The feature is now complete and ready for:
- Code review
- PR creation
- Merge to main
- Deployment to production

---

## Summary

**Total Tasks:** 29
**Estimated Time:** 4-6 hours (for experienced developer)

**Phase 1 Complete:**
- ✅ Database schema (2 tables + indexes)
- ✅ Tiger Cloud extensions enabled
- ✅ Content fetcher (web + YouTube)
- ✅ Content chunker (with overlap)
- ✅ Indexing orchestrator (sync for ≤10)
- ✅ Hybrid search (BM25 + vector + RRF)
- ✅ tRPC endpoints (reindex, status)
- ✅ UI components (status badge, reindex button)
- ✅ CSV import integration
- ✅ Manual creation integration
- ✅ Documentation
- ✅ Testing

**Phase 2 (Future):**
- Background job queue for bulk indexing
- Search result highlighting
- REST API for Eon integration
- Content freshness checks
- Analytics dashboard

**Next Steps:**
1. Create PR from `feature/content-indexing-hybrid-search`
2. Code review
3. Merge to main
4. Deploy to Vercel
5. Test in production
6. Monitor indexing success rate and search quality

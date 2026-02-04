# Content Indexing & Hybrid Search Design

**Date:** 2026-02-03
**Status:** Design - Ready for Implementation
**Author:** Claude Sonnet 4.5

## Overview

Enable full-text search on crawled content (web pages, YouTube transcripts) using Tiger Cloud's hybrid search capabilities: BM25 keyword search + semantic vector search with Reciprocal Rank Fusion (RRF).

## Goals

- Index the actual content of imported URLs (not just metadata)
- Support hybrid search (keyword + semantic) for better relevance
- Handle both small imports (sync) and bulk imports (async future)
- Showcase Tiger Cloud features: pg_textsearch, pgvector, pgai Vectorizer
- Enable external systems (like Eon) to query indexed content

## Non-Goals (Phase 1)

- Background job queue infrastructure (async indexing for 11+ items)
- Scheduled re-crawling for content freshness
- Search result highlighting in UI
- Advanced filtering (date ranges, content type)
- REST API for external access (Phase 2)

## Architecture

### High-Level Flow

```
Content Import/Creation
  ↓
Indexing Decision (≤10 sync, 11+ async)
  ↓
Content Fetching (cheerio/YouTube API)
  ↓
Chunking (if content >800 tokens)
  ↓
pgai Vectorizer (embedding generation)
  ↓
Storage (content + embeddings in PostgreSQL)
  ↓
Hybrid Search (BM25 + vector with RRF)
```

### Core Components

1. **Content Fetcher Service** (`src/server/services/content-fetcher.ts`)
   - Crawls URLs, extracts text from web pages
   - Fetches YouTube transcripts via API
   - 5-second timeout per URL
   - Returns: plain text, full text, word/token counts

2. **Chunking Service** (`src/server/services/content-chunker.ts`)
   - Splits long content into 500-800 token chunks
   - Uses tiktoken for accurate token counting
   - 50-token overlap between chunks
   - Preserves paragraph/sentence boundaries

3. **Indexing Orchestrator** (`src/server/services/indexing-orchestrator.ts`)
   - Decides sync vs async based on item count
   - Manages indexing workflow
   - Handles failures gracefully (mark as failed, allow retry)
   - Configurable threshold (default: 10 items)

4. **pgai Vectorizer** (Tiger Cloud built-in)
   - Automated embedding generation
   - Uses OpenAI text-embedding-3-small (1536 dims)
   - Handles batch embedding efficiently

5. **Search Service** (`src/server/services/search-service.ts`)
   - Parallel BM25 + vector queries
   - Client-side RRF fusion (k=60)
   - Returns top 10 results with relevance scores

### Tiger Cloud Extensions

- `pg_textsearch` - BM25 keyword search with Block-Max WAND optimization
- `pgvectorscale` - Vector storage and indexing (up to 16K dimensions)
- `pgai` - Automated embedding generation

## Database Schema

### New Tables

```sql
-- Stores full crawled content and metadata
CREATE TABLE tiger_den.content_text (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id UUID NOT NULL REFERENCES tiger_den.content_items(id) ON DELETE CASCADE,

  -- Crawled content
  full_text TEXT NOT NULL,
  plain_text TEXT NOT NULL,  -- Stripped of HTML/markdown

  -- Metadata
  word_count INTEGER NOT NULL,
  token_count INTEGER NOT NULL,  -- For chunking decisions
  content_hash TEXT NOT NULL,  -- SHA256 of plain_text
  crawled_at TIMESTAMP NOT NULL DEFAULT NOW(),
  crawl_duration_ms INTEGER,

  -- Status tracking
  index_status TEXT NOT NULL DEFAULT 'pending',  -- pending, indexed, failed
  index_error TEXT,
  indexed_at TIMESTAMP,

  UNIQUE(content_item_id)
);

-- Stores chunked content with embeddings
CREATE TABLE tiger_den.content_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_text_id UUID NOT NULL REFERENCES tiger_den.content_text(id) ON DELETE CASCADE,

  -- Chunk data
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,  -- Order within document
  chunk_token_count INTEGER NOT NULL,  -- Actual tokens (for monitoring)

  -- Vector embedding (halfvec for 50% storage savings)
  embedding halfvec(1536),

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(content_text_id, chunk_index)
);
```

### Indexes

```sql
-- Basic indexes
CREATE INDEX content_text_item_idx ON tiger_den.content_text(content_item_id);
CREATE INDEX content_text_status_idx ON tiger_den.content_text(index_status);
CREATE INDEX content_chunks_text_id_idx ON tiger_den.content_chunks(content_text_id);

-- BM25 keyword search index (pg_textsearch)
CREATE INDEX content_chunks_bm25_idx ON tiger_den.content_chunks
  USING bm25(chunk_text) WITH (text_config='english');

-- HNSW vector similarity search index (pgvector)
CREATE INDEX content_chunks_embedding_idx ON tiger_den.content_chunks
  USING hnsw(embedding halfvec_cosine_ops);
```

### Relationships

- **1:1** - One `content_text` per `content_item` (stores full original)
- **1:N** - One `content_text` to many `content_chunks` (for long content)

## Content Fetching

### Web Content Extraction

**Library:** cheerio (already in project)

**Strategy:**
- Extract main content, strip nav/footer/ads
- Preserve paragraph structure for chunking
- 5-second timeout per URL
- User-agent: Set to avoid bot blocking

**Interface:**
```typescript
interface FetchResult {
  plainText: string;
  fullText: string;  // HTML/markdown preserved
  wordCount: number;
  tokenCount: number;
  duration: number;
}

async function fetchWebContent(url: string): Promise<FetchResult>
```

### YouTube Transcript Extraction

**Library:** `youtube-transcript` npm package

**Strategy:**
- Extract auto-generated or manual captions
- Handle missing transcripts gracefully (return empty, don't fail)
- Format: Plain text with timestamps stripped

**Interface:**
```typescript
async function fetchYouTubeTranscript(videoId: string): Promise<FetchResult>
```

## Content Chunking

### Strategy

Based on Tiger Cloud hybrid search skill recommendations:

- **Target:** 500-800 tokens per chunk
- **Split on:** Paragraph boundaries first, then sentences if needed
- **Overlap:** 50 tokens between chunks (preserves context)
- **Token counting:** Use `tiktoken` for OpenAI-compatible counting
- **Never split:** Mid-sentence

### Interface

```typescript
interface Chunk {
  text: string;
  index: number;
  tokenCount: number;
}

function chunkContent(plainText: string, maxTokens: 800): Chunk[]
```

### Example

```
Input: 2500 token article
Output:
  - Chunk 0: tokens 0-800 (800 tokens)
  - Chunk 1: tokens 750-1550 (800 tokens, 50 overlap)
  - Chunk 2: tokens 1500-2300 (800 tokens, 50 overlap)
  - Chunk 3: tokens 2250-2500 (250 tokens, 50 overlap)
```

## Indexing Workflow

### Decision Logic

```typescript
if (contentItemIds.length <= config.syncThreshold) {
  // Synchronous indexing (default: ≤10 items)
  for (const id of contentItemIds) {
    try {
      await indexSingleItem(id);
    } catch (error) {
      // Mark as failed, continue with others
      await markIndexFailed(id, error);
    }
  }
} else {
  // Async background job (Phase 2)
  // For now: mark as 'pending', add manual re-index button
  await markAsPendingIndexing(contentItemIds);
}
```

### Single Item Indexing Flow

1. **Fetch content** → Call `content-fetcher.ts`
   - Try URL, timeout after 5s
   - Extract text + count tokens
   - Return FetchResult or throw error

2. **Store full content** → Insert into `content_text` table
   - Store both plain_text and full_text
   - Calculate content_hash (SHA256)
   - Set status = 'pending'

3. **Chunk if needed** → Call `content-chunker.ts`
   - If token_count > 800, split into chunks
   - If ≤ 800, create single chunk

4. **Store chunks** → Insert into `content_chunks` table
   - Store chunk_text (embedding generated by pgai)
   - Store chunk_index and token_count

5. **Wait for pgai** → Embeddings generated automatically
   - pgai Vectorizer handles embedding generation
   - Polls until embeddings are populated

6. **Mark as indexed** → Update `content_text`
   - Set index_status = 'indexed'
   - Set indexed_at = NOW()

### Error Handling

| Error Type | Behavior |
|------------|----------|
| Fetch timeout | Mark as `failed`, store error message, allow retry |
| Invalid URL | Mark as `failed`, continue with other items |
| Embedding failure | Mark as `failed`, allow retry |
| Chunking error | Mark as `failed`, log full error details |

**Key Principle:** **Fail gracefully** - Always save the content item even if indexing fails. Content is never lost, just temporarily unsearchable.

### Manual Re-indexing

**tRPC Endpoint:**
```typescript
content.reindexContent(contentItemId: string)
```

**UI:**
- Show "Re-index" button for items with status = 'failed' or 'pending'
- Button triggers re-indexing flow
- Show spinner during re-indexing
- Update status when complete

## Hybrid Search Implementation

Based on Tiger Cloud's `postgres-hybrid-text-search` skill.

### Query Pattern (Parallel Execution)

```typescript
async function hybridSearch(
  query: string,
  embedding: number[],  // From pgai or OpenAI API
  limit: number = 10
): Promise<SearchResult[]> {

  // Run both queries in parallel
  const [keywordResults, semanticResults] = await Promise.all([
    // Query 1: BM25 keyword search
    db.execute(sql`
      SELECT
        ct.content_item_id,
        cc.id as chunk_id,
        cc.chunk_text,
        cc.chunk_text <@> ${query} as score
      FROM tiger_den.content_chunks cc
      JOIN tiger_den.content_text ct ON ct.id = cc.content_text_id
      ORDER BY score
      LIMIT 50
    `),

    // Query 2: Vector semantic search
    db.execute(sql`
      SELECT
        ct.content_item_id,
        cc.id as chunk_id,
        cc.chunk_text,
        cc.embedding <=> ${embedding}::halfvec(1536) as distance
      FROM tiger_den.content_chunks cc
      JOIN tiger_den.content_text ct ON ct.id = cc.content_text_id
      ORDER BY distance
      LIMIT 50
    `)
  ]);

  // Fuse with RRF (k=60)
  return rrfFusion(keywordResults, semanticResults, 60, limit);
}
```

### RRF Fusion Algorithm

**Reciprocal Rank Fusion:** Combines rankings from multiple searches. Each result's score is `1 / (k + rank)` where `k = 60` (standard constant).

```typescript
function rrfFusion(
  keywordResults: Row[],
  semanticResults: Row[],
  k: number = 60,
  limit: number = 10
): SearchResult[] {
  const scores = new Map<string, number>();
  const dataMap = new Map<string, Row>();

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
        matchType: 'hybrid'
      };
    });
}
```

### Embedding Generation

**Recommended:** Let pgai Vectorizer handle embeddings automatically during chunk insert.

**Alternative:** Generate query embeddings on-demand with OpenAI API, cache for performance.

### Search UI Integration

**Enhancements to existing content search:**

1. Add "Search in content" checkbox (default: off)
2. When enabled, run hybrid search on indexed content
3. Show matched chunks with ellipsis: "...relevant excerpt..."
4. Link to original content item
5. Highlight search terms in results (Phase 2)

## Configuration

### Environment Variables

```bash
# Indexing configuration
INDEXING_SYNC_THRESHOLD=10           # Items to index synchronously
INDEXING_TIMEOUT_MS=5000             # Timeout per URL fetch
ENABLE_CONTENT_INDEXING=true         # Feature flag

# OpenAI for embeddings (pgai)
OPENAI_API_KEY=sk-...

# Search configuration
SEARCH_RRF_K=60                      # RRF constant
SEARCH_CANDIDATES_PER_METHOD=50      # Candidate pool size
```

### Configuration File

```typescript
// src/server/config/indexing-config.ts
export const indexingConfig = {
  syncThreshold: parseInt(env.INDEXING_SYNC_THRESHOLD ?? '10'),
  timeoutPerUrl: parseInt(env.INDEXING_TIMEOUT_MS ?? '5000'),
  enableIndexing: env.ENABLE_CONTENT_INDEXING === 'true',
  chunkMaxTokens: 800,
  chunkOverlapTokens: 50,
  rrfK: 60,
  candidatesPerSearch: 50,
};
```

## Dependencies

### New npm Packages

```json
{
  "youtube-transcript": "^1.2.1",
  "tiktoken": "^1.0.15",
  "pgvector": "^0.2.0"
}
```

### PostgreSQL Extensions

```sql
-- Run on Tiger Cloud service via SQL editor or psql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_textsearch;
CREATE EXTENSION IF NOT EXISTS pgai CASCADE;
```

### pgai Vectorizer Setup

```sql
-- Configure automatic embedding generation
-- Reference: https://github.com/timescale/pgai
SELECT pgai.create_vectorizer(
  'tiger_den.content_chunks',
  embedding => 'embedding',
  chunking => 'chunk_text',
  formatting => jsonb_build_object(
    'model', 'text-embedding-3-small',
    'dimensions', 1536
  )
);
```

## External Access (Phase 2)

### Direct Database Access (Available Now)

External systems like Eon can query the database directly:

```sql
-- Direct BM25 search
SELECT ci.title, ci.current_url, cc.chunk_text
FROM tiger_den.content_chunks cc
JOIN tiger_den.content_text ct ON ct.id = cc.content_text_id
JOIN tiger_den.content_items ci ON ci.id = ct.content_item_id
ORDER BY cc.chunk_text <@> 'query text'
LIMIT 50;

-- Direct vector search
SELECT ci.title, ci.current_url, cc.chunk_text
FROM tiger_den.content_chunks cc
JOIN tiger_den.content_text ct ON ct.id = cc.content_text_id
JOIN tiger_den.content_items ci ON ci.id = ct.content_item_id
ORDER BY cc.embedding <=> '[...]'::halfvec(1536)
LIMIT 50;
```

**Pros:**
- Fast (no API hop)
- Leverages Tiger Cloud's PostgreSQL access
- Can use advanced SQL features

**Cons:**
- Need to implement RRF fusion logic in each client
- Tight coupling to schema
- Connection pooling management

### REST API Wrapper (Phase 2 - Future)

**Endpoint:**
```
POST /api/v1/content/search
Authorization: Bearer <api-key>

Request:
{
  "query": "search text",
  "limit": 10,
  "filters": {
    "contentType": ["blog_post", "case_study"],
    "dateRange": {
      "start": "2024-01-01",
      "end": "2024-12-31"
    }
  }
}

Response:
{
  "results": [
    {
      "contentItemId": "uuid",
      "title": "Title",
      "url": "https://...",
      "contentType": "blog_post",
      "matchedChunk": "...relevant excerpt...",
      "relevanceScore": 0.95,
      "publishDate": "2024-02-15"
    }
  ],
  "total": 42,
  "searchTime": "123ms"
}
```

**Benefits:**
- Clean abstraction layer
- Version control for API changes
- Authentication and rate limiting
- RRF fusion handled once (DRY)
- Easier for external systems like Eon

**Implementation Tasks (Phase 2):**
- Add Express/tRPC REST endpoints
- API key authentication
- Rate limiting (per client)
- Response caching (Redis)
- API documentation (OpenAPI/Swagger)

## Testing Strategy

### Unit Tests

- **Content Fetcher:** Mock HTTP requests, test parsing
- **Chunker:** Test boundary detection, overlap logic
- **RRF Fusion:** Test scoring algorithm, edge cases

### Integration Tests

- **E2E Indexing:** Mock URLs → database → verify chunks
- **Search Flow:** Insert test data → search → verify results
- **Error Handling:** Timeout scenarios, invalid URLs

### Manual Testing

1. Import 5-10 tigerdata.com URLs
2. Verify content is fetched and chunked correctly
3. Run search queries, verify relevant results
4. Test re-index functionality
5. Check indexing status in UI

### Performance Testing

- Import 100 items, measure total time
- Search latency with 1000+ indexed chunks
- Monitor database size growth

## Rollout Plan

### Phase 1: MVP (Current Design)

**Scope:**
- ✅ Database schema + extensions
- ✅ Content fetcher (web + YouTube)
- ✅ Chunking service
- ✅ Sync indexing only (≤10 items)
- ✅ Hybrid search with RRF
- ✅ Basic search UI (checkbox to enable)
- ✅ Manual re-index button
- ✅ Status tracking UI

**Timeline:** 2-3 weeks

**Success Criteria:**
- Indexing success rate >90%
- Search latency <500ms
- User can search indexed content

### Phase 2: Production Hardening (Future)

**Scope:**
- Background job queue (BullMQ or pg-boss)
- Async indexing for bulk imports (11+ items)
- Search result highlighting in UI
- Advanced filtering (date, content type, campaigns)
- Content freshness checks (re-crawl on schedule)
- REST API for external access (Eon integration)
- Analytics dashboard (search queries, result clicks)
- Performance optimization (caching, query tuning)

**Timeline:** 4-6 weeks

**Success Criteria:**
- Support bulk imports (100+ items)
- External systems can query via API
- Search quality metrics tracked

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **Timeouts on slow sites** | 5-second timeout, mark as failed, allow retry |
| **Embedding API costs** | Monitor usage, set budget alerts, feature flag |
| **Large imports block UI** | Phase 2: background jobs; Phase 1: manual re-index |
| **Poor search quality** | Collect user feedback, tune RRF weights, add filters |
| **Database size growth** | Monitor storage, implement retention policies if needed |
| **Schema changes break Eon** | Document schema, version API in Phase 2 |

## Success Metrics

### Phase 1 Metrics

- **Indexing Success Rate:** >90% of URLs successfully indexed
- **Search Latency:** <500ms for hybrid search (p95)
- **User Adoption:** % of searches using "Search in content" feature
- **Content Coverage:** % of content items with status='indexed'

### Phase 2 Metrics

- **API Usage:** Requests/day from external systems (Eon)
- **Search Quality:** Click-through rate on search results
- **System Performance:** Indexing throughput (items/minute)
- **Cost:** OpenAI API costs per 1000 embeddings

## References

- [Tiger Cloud pg_textsearch Documentation](https://www.tigerdata.com/docs/use-timescale/latest/extensions/pg-textsearch)
- [Tiger Cloud Hybrid Search Skill](mcp://tiger/view_skill/postgres-hybrid-text-search)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [pgai Vectorizer](https://github.com/timescale/pgai)
- [Reciprocal Rank Fusion Paper](https://en.wikipedia.org/wiki/Mean_reciprocal_rank)

---

**Design Status:** ✅ Validated and ready for implementation planning

**Next Steps:**
1. Review and approve design
2. Create implementation plan with task breakdown
3. Set up git worktree for isolated development
4. Begin Phase 1 implementation

# Tiger Den - Follow-Up Items

## CSV Import Improvements

## Other Features

### CSV importer validator

CSV import should offer the ablity to validate the importing CSV before the import begins (simple validation like proper fields/formatting) so that we don't get errors we could fix before it even tries to import

### Other metadata enrichment

It would be helpful to add some fields that might include topics or technlogies - which we could then search on. Should also include a brief abstract/summary of the content piece.

These can possibly be handled in import, but really would be very nice if there was a way to add some AI parsing/enrichment. Could happen as a background job so that it's not holding up import, etc. 

Actually - should we be ingesting all of the actual text content etc of the content piece? then we can search on the content vs just the metadata. consider using things like pg_textsearch etc (feature of tigerdata)

---

## Deferred Features

### CSV Export Functionality (Task 14)
**Status:** Deferred
**Description:** Export filtered content to CSV file
**Notes:** Intentionally skipped during initial implementation per user request

---

## Completed Features

### Progress Indicator During Import
**Completed:** 2026-02-02
**Description:** Real-time progress updates during CSV import using SSE
**Implementation:**
- Server-Sent Events for streaming progress
- Progress bar with percentage and phase indicators
- Batched updates every 10 rows
- Error count tracking
- Keep-alive pings for long imports

### Metadata Enrichment
**Completed:** 2026-02-02
**Description:** Auto-fetch page titles from URLs during CSV import when title field is blank
**Implementation:**
- Fetches HTML title tags with 5-second timeout
- Shows enrichment progress during import
- Displays enrichment summary in results
- Gracefully handles failures (leaves title blank)

### Flexible Date Format Parsing
**Completed:** 2026-02-03
**Description:** Accept multiple date formats during CSV import and auto-convert to YYYY-MM-DD
**Implementation:**
- Supports 10 common date formats (US, written, international)
- Automatic format detection and conversion
- date-fns library for parsing
- Backward compatible with existing YYYY-MM-DD format
- Clear validation errors for unparseable dates

**Supported Formats:**
- YYYY-MM-DD (2024-02-15)
- MM/DD/YYYY (02/15/2024)
- M/D/YYYY (2/5/2024)
- Written formats: February 15, 2024 / Feb 15, 2024
- Period formats: January 20. 2026 / Jan 20. 2026
- International: 15 February 2024
- Dash formats: 02-15-2024 / 2-5-2024

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

---

*Last Updated: 2026-02-03*

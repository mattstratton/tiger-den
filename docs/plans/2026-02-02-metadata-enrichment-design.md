# Metadata Enrichment Feature - Design Document

**Date:** 2026-02-02
**Feature:** Auto-fetch page titles from URLs during CSV import when title field is blank

---

## Overview

When importing content via CSV, automatically fetch and populate the title field from the webpage's `<title>` tag if the title is left blank. This reduces manual data entry and ensures more complete content records.

## Design Decisions

### 1. Timing: Synchronous During Import
**Decision:** Fetch titles during the CSV import process, before database insertion
**Rationale:**
- Tiger Den has a 1000-row import limit, making synchronous fetching practical
- Users get complete data immediately
- No need for complex background job infrastructure
- Clear feedback in import results

### 2. Error Handling: Skip and Continue
**Decision:** If title fetch fails, leave the field blank and continue importing the row
**Rationale:**
- Import shouldn't fail just because a website is slow or down
- Users can easily identify and manually fill blank titles later
- More flexible and user-friendly
- Enrichment is a "best effort" enhancement, not a requirement

### 3. Timeout: 5 Seconds Per URL
**Decision:** Wait up to 5 seconds for each URL to respond
**Rationale:**
- Balances speed vs. success rate
- Most modern websites respond within 2-3 seconds
- Catches 95%+ of working URLs
- For 50 URLs: ~4 minutes max (acceptable for automatic enrichment)

### 4. Progress Feedback: Show Enrichment Count
**Decision:** Display enrichment status in the UI: "Fetching titles from URLs..."
**Rationale:**
- Better user experience than silent waiting
- Simple implementation without streaming complexity
- Users understand what's happening

**Limitation:** tRPC mutations don't support streaming, so we can't show real-time counters (1/8, 2/8, etc.). We show a general "Fetching titles..." message, then report summary in results.

### 5. Enrichment Trigger: Only Empty Titles
**Decision:** Fetch title only when the title field is completely empty (null, undefined, or empty string)
**Rationale:**
- Clear and predictable behavior
- Respects any user-provided title, even placeholders like "TBD"
- No risk of overwriting intentional placeholders
- Simple logic to implement

---

## Architecture

### High-Level Flow

```
CSV Upload → Parse Rows → Identify Blank Titles → Fetch Titles (5s timeout each)
→ Update Rows → Validate → Insert to DB → Show Results
```

### Components

#### 1. Title Fetcher Service
**File:** `src/server/services/title-fetcher.ts`
**Purpose:** Fetch webpage and extract `<title>` tag
**Dependencies:** `cheerio` (HTML parsing library)

**Key Functions:**
- `fetchPageTitle(url: string): Promise<string | null>`
  - Uses native `fetch` with `AbortController` for 5-second timeout
  - Returns title string on success, null on failure
  - Handles redirects, non-HTML content, malformed HTML gracefully

**Implementation:**
```typescript
async function fetchPageTitle(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TigerDen-MetadataBot/1.0' }
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/html')) return null;

    const html = await response.text();
    const $ = cheerio.load(html);
    const title = $('title').text().trim();

    return title || null;
  } catch {
    return null; // Timeout, network error, parsing error, etc.
  } finally {
    clearTimeout(timeout);
  }
}
```

#### 2. CSV Router Enhancement
**File:** `src/server/api/routers/csv.ts`
**Changes:**
- Add enrichment phase before validation loop
- Track enrichment statistics (attempted, successful, failed)
- Update response to include enrichment summary

**Enrichment Logic:**
```typescript
// Before validation loop
const enrichmentStats = { attempted: 0, successful: 0, failed: 0 };

for (const row of input.rows) {
  if (!row.title || row.title.trim() === '') {
    enrichmentStats.attempted++;
    const title = await fetchPageTitle(row.current_url);
    if (title) {
      row.title = title;
      enrichmentStats.successful++;
    } else {
      enrichmentStats.failed++;
    }
  }
}

// Continue with existing validation and import logic...

return {
  successful,
  failed,
  errors,
  enrichment: enrichmentStats
};
```

#### 3. UI Progress Updates
**File:** `src/app/content/_components/import-csv-dialog.tsx`
**Changes:**
- Add enrichment state tracking
- Update importing message to show enrichment status
- Display enrichment results in import summary

**State Management:**
```typescript
const [enriching, setEnriching] = useState(false);

// Update message display
{enriching ? (
  <p>Fetching titles from URLs...</p>
) : importing ? (
  <p>Importing content items...</p>
) : null}
```

**Results Display:**
```typescript
{result.enrichment && result.enrichment.attempted > 0 && (
  <Alert>
    <AlertTitle>Title Enrichment</AlertTitle>
    <AlertDescription>
      Fetched {result.enrichment.successful} of {result.enrichment.attempted} titles from URLs.
      {result.enrichment.failed > 0 && ` (${result.enrichment.failed} failed)`}
    </AlertDescription>
  </Alert>
)}
```

---

## Error Handling

### Fetch Failures
**Scenarios:**
- Timeout (>5 seconds)
- Network errors (DNS, connection refused)
- Non-HTML content (PDF, image, video)
- Invalid/malformed HTML
- Rate limiting / 429 errors

**Handling:** Return `null`, leave title blank, continue import, track in `enrichment.failed`

### CSV Validation Changes
**Current:** `title: z.string().min(1, "Title is required")`
**New:** `title: z.string().optional().or(z.literal(""))`

This allows blank titles to pass validation since they may be enriched. After enrichment, if title is still blank, the row imports successfully with a blank title field.

---

## Performance Considerations

**Sequential Fetching:**
- Fetch titles one at a time (not in parallel)
- Avoids overwhelming target servers
- Prevents rate limiting issues

**Import Duration Estimates:**
- 10 rows with blank titles: ~30-50 seconds
- 50 rows with blank titles: ~3-4 minutes
- 1000 rows with blank titles: ~1.5 hours (edge case)

**Recommendation:** Document in UI that large imports with many blank titles will take time. Most real-world imports have <20% blank titles.

---

## Edge Cases

1. **URL is valid but title tag is empty**
   - Result: Title remains blank after enrichment
   - Row imports successfully

2. **URL redirects to different page**
   - Fetch follows redirects automatically
   - Title extracted from final destination page

3. **Website blocks bots/requires JavaScript**
   - Fetch returns non-HTML or blocked content
   - Result: Title remains blank, row imports successfully

4. **Duplicate URLs within CSV**
   - Each URL fetched once (existing duplicate detection prevents)
   - Title fetched before duplicate check

5. **Mixed blank/filled titles in CSV**
   - Only blank titles trigger fetching
   - Filled titles are respected as-is

---

## Testing Strategy

### Unit Tests
- Test `fetchPageTitle()` with mock responses
- Test timeout behavior
- Test non-HTML content handling
- Test malformed HTML parsing

### Integration Tests
1. Import CSV with all blank titles
2. Import CSV with mixed blank/filled titles
3. Import CSV with invalid URLs (should fail validation before enrichment)
4. Import with slow/timeout URLs
5. Import with non-HTML URLs (PDFs, images)

### Manual Testing
- Test with real URLs (Wikipedia, news sites, blog posts)
- Test with dead/404 URLs
- Test with redirecting URLs
- Test with very slow URLs (>5 seconds)
- Verify enrichment summary displays correctly

---

## Implementation Tasks

1. **Install cheerio dependency**
   - `npm install cheerio`
   - `npm install -D @types/cheerio`

2. **Create title fetcher service**
   - Create `src/server/services/title-fetcher.ts`
   - Implement `fetchPageTitle()` with timeout and error handling
   - Add unit tests

3. **Update CSV router**
   - Add enrichment loop before validation
   - Track enrichment statistics
   - Update response type to include enrichment summary

4. **Update CSV import dialog**
   - Add enrichment state management
   - Update importing message
   - Display enrichment results in summary

5. **Update CSV schema validation**
   - Make title optional in csvRowSchema
   - Update error messages if needed

6. **Test and refine**
   - Test with various URL types
   - Verify timeout behavior
   - Check enrichment feedback in UI

7. **Update documentation**
   - Document feature in README
   - Add to FOLLOW-UP.md as completed
   - Update CSV import instructions

---

## Future Enhancements (Out of Scope)

- Parallel fetching with rate limiting
- Real-time progress updates via WebSocket/SSE
- Configurable timeout per import
- Cache fetched titles to avoid re-fetching same URLs
- Support for Open Graph tags as fallback (`og:title`)
- Fetch other metadata (description, author, publish date)
- Retry logic for failed fetches

---

*Design validated and approved: 2026-02-02*

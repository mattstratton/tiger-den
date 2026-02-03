# Tiger Den - Follow-Up Items

## CSV Import Improvements

### 1. Flexible Date Format Parsing
**Priority:** Medium
**Description:** Accept and convert standard date formats during CSV import
**Current Behavior:** Only accepts YYYY-MM-DD format
**Desired Behavior:** Accept common date formats and automatically convert them:
- MM/DD/YYYY
- DD/MM/YYYY
- Month DD, YYYY
- ISO 8601 formats
- Timestamps

**Implementation Notes:**
- Use date parsing library (date-fns parse, dayjs, etc.)
- Provide clear error messages for ambiguous dates
- Consider adding date format selection in import dialog
- Document accepted formats in template

## Other Features

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

---

*Last Updated: 2026-02-02*

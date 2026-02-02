# Tiger Den - Follow-Up Items

## CSV Import Improvements

### 1. Progress Indicator During Import
**Priority:** Medium
**Description:** Add a progress indicator to show upload/processing status during CSV import
**Current Behavior:** No visual feedback during import processing
**Desired Behavior:** Show progress bar or spinner with status (e.g., "Processing row 45 of 100...")

**Implementation Notes:**
- Consider using streaming/chunked processing for large files
- Update UI with real-time progress
- Show estimated time remaining for large imports

### 2. Flexible Date Format Parsing
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

### Metadata enrichment
When importing, if the TITLE field is blank on an import, we might be able to do something where the system goes to the URL and pulls in the TITLE attribute of the webpage? Let's discuss how best to do this (during import or maybe there's an async enrichment job?)

---

## Deferred Features

### CSV Export Functionality (Task 14)
**Status:** Deferred
**Description:** Export filtered content to CSV file
**Notes:** Intentionally skipped during initial implementation per user request

---

*Last Updated: 2026-02-02*

# Manual Testing Instructions for Title Enrichment

## Overview
This document provides step-by-step instructions for manually testing the CSV import title enrichment feature. Four test CSV files have been prepared in the `test-csvs/` directory.

## Prerequisites

1. **Dev Server Running:**
   ```bash
   npm run dev
   ```
   The server should be running on http://localhost:3000

2. **Authentication:**
   - You must be logged in with Google OAuth
   - Navigate to http://localhost:3000 and sign in if not already authenticated

3. **Test Files:**
   All test CSV files are in: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/test-csvs/`

## Test Execution

### Scenario 1: Blank Titles with Valid URLs

**File:** `scenario1-blank-titles.csv`

**Steps:**
1. Open http://localhost:3000/content in your browser
2. Click the "Import CSV" button (should be visible on the page)
3. Either drag-and-drop or click to select `scenario1-blank-titles.csv`
4. **Observe:**
   - "Importing content items..." message appears
   - "Fetching titles from URLs..." message appears
5. **Wait** for import to complete (may take 5-15 seconds)
6. **Verify Results:**
   - Success message should show: "Successfully imported 3 content items"
   - Enrichment message should show: "Fetched 3 of 3 titles from URLs"
   - Click "Close" or "Import Another File"
7. **Check Content List:**
   - Look for the 3 new items in the content table
   - Verify titles are NOT URLs, but actual page titles:
     - PostgreSQL Wikipedia page title
     - TimescaleDB GitHub repository title
     - Anthropic website title

**Expected Outcome:**
- ✅ 3/3 imports successful
- ✅ 3/3 titles enriched
- ✅ Actual page titles displayed, not URLs

**Troubleshooting:**
- If you see URLs instead of titles, enrichment failed
- Check browser console (F12) for errors
- Check terminal/server logs for errors

---

### Scenario 2: Mixed Blank and Pre-filled Titles

**File:** `scenario2-mixed-titles.csv`

**Steps:**
1. In the content page, click "Import CSV" again
2. Select `scenario2-mixed-titles.csv`
3. **Observe:**
   - "Fetching titles from URLs..." message appears
4. **Wait** for import to complete
5. **Verify Results:**
   - Success message: "Successfully imported 4 content items"
   - Enrichment message: "Fetched 2 of 2 titles from URLs"
   - Note: Only 2 titles fetched (2 were pre-filled)
6. **Check Content List:**
   - Look for the 4 new items
   - Verify:
     - Row with HackerNews URL shows: "Pre-filled Title 1" (NOT changed)
     - Row with StackOverflow URL shows: fetched title (e.g., "Stack Overflow - Where Developers Learn...")
     - Row with MDN URL shows: "Pre-filled Title 2" (NOT changed)
     - Row with PostgreSQL.org URL shows: fetched title

**Expected Outcome:**
- ✅ 4/4 imports successful
- ✅ 2/2 blank titles enriched
- ✅ 2 pre-filled titles unchanged

**Key Check:** Pre-filled titles must NOT be replaced with fetched titles.

---

### Scenario 3: Slow/Timeout URLs

**File:** `scenario3-slow-timeout.csv`

⚠️ **Warning:** This test will take at least 5 seconds due to timeouts.

**Steps:**
1. In the content page, click "Import CSV"
2. Select `scenario3-slow-timeout.csv`
3. **Observe:**
   - "Fetching titles from URLs..." message appears
   - Import may take 5-10 seconds (waiting for timeouts)
4. **Wait** patiently for import to complete
5. **Verify Results:**
   - Success message: "Successfully imported 3 content items"
   - Enrichment message: "Fetched 1 of 3 titles from URLs. (2 failed)"
   - Note: 2 enrichments failed, but imports still succeeded
6. **Check Content List:**
   - Look for the 3 new items
   - Verify:
     - Row with httpstat.us URL: shows URL as title (timeout fallback)
     - Row with example.invalid URL: shows URL as title (error fallback)
     - Row with Cloudflare URL: shows fetched title

**Expected Outcome:**
- ✅ 3/3 imports successful (despite enrichment failures)
- ✅ 1/3 titles enriched successfully
- ✅ 2/3 enrichment failures handled gracefully
- ✅ Failed rows still imported with URL as title

**Key Check:** Failed enrichments do NOT block imports.

---

### Scenario 4: Non-HTML URLs

**File:** `scenario4-non-html.csv`

**Steps:**
1. In the content page, click "Import CSV"
2. Select `scenario4-non-html.csv`
3. **Observe:**
   - "Fetching titles from URLs..." message appears
4. **Wait** for import to complete
5. **Verify Results:**
   - Success message: "Successfully imported 3 content items"
   - Enrichment message: "Fetched 1 of 2 titles from URLs. (1 failed)"
   - Note: PDF URL enrichment failed (non-HTML content)
6. **Check Content List:**
   - Look for the 3 new items
   - Verify:
     - Row with PDF URL: shows URL as title (non-HTML fallback)
     - Row with Timescale.com URL: shows fetched title
     - Row with GitHub raw markdown URL: shows "Pre-filled Title" (not changed)

**Expected Outcome:**
- ✅ 3/3 imports successful
- ✅ 1/2 blank titles enriched (1 was non-HTML)
- ✅ Non-HTML content handled gracefully
- ✅ Pre-filled title unchanged

**Key Check:** Non-HTML content (PDF) doesn't crash the import.

---

## Verification Checklist

After completing all scenarios, verify:

### UI Behavior
- [ ] "Fetching titles from URLs..." message appears during enrichment
- [ ] Enrichment statistics displayed correctly in results
- [ ] Success/failure counts accurate
- [ ] Import completes even when enrichment fails
- [ ] Dialog can be closed and reopened for multiple imports

### Data Integrity
- [ ] Blank titles are enriched with page titles (when possible)
- [ ] Pre-filled titles are never changed
- [ ] Failed enrichments fall back to URL as title
- [ ] All valid CSV rows are imported (enrichment failures don't block)
- [ ] Content items appear in the content list
- [ ] Campaigns are auto-created (Test Campaign)

### Error Handling
- [ ] No errors in browser console (F12 → Console tab)
- [ ] No errors in server logs (terminal running `npm run dev`)
- [ ] Timeouts handled gracefully (no crashes)
- [ ] Invalid URLs handled gracefully (no crashes)
- [ ] Non-HTML content handled gracefully (no crashes)

### Performance
- [ ] Scenario 1: Completes in ~5-10 seconds (3 fetches)
- [ ] Scenario 2: Completes in ~5-10 seconds (2 fetches)
- [ ] Scenario 3: Completes in ~10-15 seconds (includes timeouts)
- [ ] Scenario 4: Completes in ~5-10 seconds (2 fetches, 1 fails fast)

## Cleanup

After testing, you may want to clean up test data:

1. **Option 1: Delete Individual Items**
   - Go to content list
   - Delete test items one by one

2. **Option 2: Delete All Content (Testing Only)**
   - Use the debug endpoint if available
   - Or manually delete from database

## Expected Console Output

During import, you should see:
- No errors in browser console
- Server logs showing successful imports
- Possible timeout warnings (expected for scenario 3)

## Reporting Results

After completing all tests, update `TEST_RESULTS.md` with:
- Checkboxes marked for completed scenarios
- Actual results (did they match expected?)
- Any unexpected behavior or bugs discovered
- Screenshots (optional but helpful):
  - Import dialog during "Fetching titles..." phase
  - Import results showing enrichment stats
  - Content list showing fetched titles

## Success Criteria

All tests pass if:
1. ✅ Blank titles are enriched from URLs (when possible)
2. ✅ Pre-filled titles remain unchanged
3. ✅ Failed enrichments don't block imports
4. ✅ UI shows accurate enrichment statistics
5. ✅ No errors in console or server logs
6. ✅ Import completes for all scenarios

## Next Steps

After manual testing:
1. Mark checkboxes in TEST_RESULTS.md
2. Document any issues found
3. If all tests pass, create commit:
   ```bash
   git add test-csvs/ TEST_RESULTS.md TESTING_INSTRUCTIONS.md
   git commit -m "test(csv): manual testing of title enrichment

   - Created 4 test CSV scenarios
   - Tested blank titles, mixed titles, timeouts, non-HTML
   - Verified enrichment stats display correctly
   - Confirmed graceful failure handling

   All tests passed. Title enrichment working as expected.

   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   ```

# Test CSV Files for Title Enrichment

This directory contains 4 test CSV files for manual testing of the title enrichment feature.

## Quick Reference

| File | Purpose | Rows | Expected Enrichment |
|------|---------|------|---------------------|
| `scenario1-blank-titles.csv` | Basic enrichment | 3 | 3/3 successful |
| `scenario2-mixed-titles.csv` | Selective enrichment | 4 | 2/2 blank only |
| `scenario3-slow-timeout.csv` | Error handling | 3 | 1/3 successful |
| `scenario4-non-html.csv` | Content-type handling | 3 | 1/2 successful |

## Testing Order

1. **scenario1-blank-titles.csv** - Start here to verify basic functionality
2. **scenario2-mixed-titles.csv** - Verify pre-filled titles not changed
3. **scenario3-slow-timeout.csv** - Verify error handling (takes longer)
4. **scenario4-non-html.csv** - Verify content-type checking

## File Details

### scenario1-blank-titles.csv
- 3 rows, all with blank titles
- Valid, accessible URLs (Wikipedia, GitHub, Anthropic)
- Should successfully fetch 3 titles

### scenario2-mixed-titles.csv
- 4 rows, 2 blank + 2 pre-filled
- Should only fetch 2 titles (blank ones)
- Pre-filled titles must remain unchanged

### scenario3-slow-timeout.csv
⚠️ Takes 5-10 seconds due to timeout testing
- 1 slow URL (15s delay, will timeout)
- 1 invalid URL (will fail)
- 1 valid URL (will succeed)
- Should import all 3 rows despite 2 enrichment failures

### scenario4-non-html.csv
- 1 PDF URL (should fail enrichment)
- 1 HTML URL (should succeed)
- 1 pre-filled title (should not change)

## How to Use

1. Navigate to http://localhost:3000/content
2. Click "Import CSV" button
3. Select a test file
4. Observe the import process
5. Verify results match expectations
6. Check content list for imported items

## Expected Behavior

- ✅ "Fetching titles from URLs..." message appears
- ✅ Enrichment statistics shown after import
- ✅ Failed enrichments don't block imports
- ✅ Actual page titles displayed (not URLs)
- ✅ Pre-filled titles never changed

## Progress Indicator Testing

### progress-medium.csv (50 rows)
- 50 rows total
- Mix of blank titles (10) and pre-filled titles (40)
- Real URLs for enrichment testing
- Tests batched progress updates
- Expected duration: ~1-2 minutes

## Cleanup

After testing, you may want to delete the test content items from the UI.

## See Also

- `../TESTING_INSTRUCTIONS.md` - Detailed step-by-step instructions
- `../TEST_RESULTS.md` - Expected results and checklist
- `../TASK7_SUMMARY.md` - Overview and summary

# Production Testing Quick Start Guide

## 🚀 Ready to Test!

Your metadata enrichment feature has been successfully deployed to production.

**Production URL:** https://tiger-den.vercel.app

---

## Quick Test (5 minutes)

### 1. Open Production Site
```
https://tiger-den.vercel.app
```

### 2. Sign In
- Use your authorized Google account

### 3. Import Test CSV
- Click **"Import CSV"** button
- Select file: `test-csvs/scenario1-blank-titles.csv`
- Watch for "Fetching titles from URLs..." message

### 4. Verify Results
Look for in the import summary:
- ✅ "5 titles fetched from URLs"
- ✅ "0 titles failed to fetch"
- ✅ "0 titles skipped"

### 5. Check Content List
- 5 new items should appear
- Titles should be actual page titles, not URLs
- Example: "What is a Vector Database?" instead of "https://www.timescale.com/..."

---

## Test Files Location

All test CSV files are in:
```
/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/test-csvs/
```

**Available files:**
1. `scenario1-blank-titles.csv` - Main test (5 blank titles)
2. `scenario2-mixed-titles.csv` - Mixed (3 blank, 3 filled)
3. `scenario3-slow-timeout.csv` - Timeout handling
4. `scenario4-non-html.csv` - Error handling

---

## Expected Behavior

### What You Should See:
1. During import: "Fetching titles from URLs..." message
2. After import: Enrichment statistics in summary dialog
3. In content list: Items with actual page titles (not URLs)

### What Success Looks Like:
```
Import Summary
✓ Imported 5 content items
✓ Created 1 new campaign
✓ 5 titles fetched from URLs
✓ 0 titles failed to fetch
✓ 0 titles skipped (already had titles)
```

---

## If Issues Occur

### Common Issues:
1. **Timeout errors** - URLs taking too long (>15 seconds)
   - Should fall back to URL as title
   - Not a critical failure

2. **Network errors** - Unable to reach URL
   - Should fall back to URL as title
   - Check enrichment statistics for failures

3. **Vercel timeout** - Import takes too long overall
   - Hobby plan has 10-second function timeout
   - Try smaller CSV files

### Reporting Issues:
Document in `PRODUCTION_TEST_RESULTS.md`:
- What happened
- Expected vs actual behavior
- Error messages (if any)
- Browser console errors (open DevTools)

---

## Full Documentation

For detailed testing instructions and results template:
- `TASK9_DEPLOYMENT_SUMMARY.md` - Complete deployment guide
- `PRODUCTION_TEST_RESULTS.md` - Test results template
- `test-csvs/README.md` - Test file descriptions

---

## Success Criteria

Mark as successful if:
- ✅ Can authenticate with Google
- ✅ Can upload CSV with blank titles
- ✅ See "Fetching titles..." message
- ✅ Enrichment statistics display
- ✅ Titles fetched from URLs (not just using URL as title)
- ✅ Content items created successfully

---

**Ready to test?** Head to https://tiger-den.vercel.app and start with `scenario1-blank-titles.csv`!

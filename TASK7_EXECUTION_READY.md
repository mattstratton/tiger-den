# Task 7: Test With Real URLs - READY FOR EXECUTION

## Status: ✅ PREPARED - READY FOR MANUAL TESTING

All test materials have been prepared. Manual testing can now begin.

---

## What Has Been Done

### 1. Test CSV Files Created ✓
Location: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/test-csvs/`

- ✅ `scenario1-blank-titles.csv` - 3 rows, all blank titles, valid URLs
- ✅ `scenario2-mixed-titles.csv` - 4 rows, 2 blank + 2 pre-filled titles
- ✅ `scenario3-slow-timeout.csv` - 3 rows, includes timeout and error cases
- ✅ `scenario4-non-html.csv` - 3 rows, includes PDF and pre-filled title
- ✅ `README.md` - Quick reference guide for test files

### 2. Documentation Created ✓

- ✅ **TESTING_INSTRUCTIONS.md** - Detailed step-by-step testing guide (PRIMARY GUIDE)
- ✅ **TEST_CHECKLIST.md** - Printable checklist for during testing (USE WHILE TESTING)
- ✅ **TEST_RESULTS.md** - Template for documenting results (UPDATE AFTER TESTING)
- ✅ **TASK7_SUMMARY.md** - Overview and context
- ✅ **TASK7_EXECUTION_READY.md** - This file

### 3. Implementation Verified ✓

Code review confirms:
- ✅ Title fetcher service properly implemented
- ✅ CSV import router includes enrichment logic
- ✅ UI displays enrichment statistics
- ✅ Error handling is graceful
- ✅ Pre-filled titles are protected

### 4. Environment Verified ✓

- ✅ Dev server is running on port 3000
- ✅ Application is accessible at http://localhost:3000

---

## How to Execute Tests

### Step 1: Open Testing Guide
**File:** `TESTING_INSTRUCTIONS.md`

This is your primary guide with detailed instructions for each scenario.

### Step 2: Use Testing Checklist
**File:** `TEST_CHECKLIST.md`

Print or keep open while testing to check off each step.

### Step 3: Execute Tests
1. Navigate to http://localhost:3000/content
2. Import `scenario1-blank-titles.csv`
3. Verify results
4. Import `scenario2-mixed-titles.csv`
5. Verify results
6. Import `scenario3-slow-timeout.csv` (takes longer)
7. Verify results
8. Import `scenario4-non-html.csv`
9. Verify results

### Step 4: Document Results
**File:** `TEST_RESULTS.md`

Update with actual results, mark checkboxes, note any issues.

### Step 5: Create Commit
If all tests pass:
```bash
git add test-csvs/ TEST_RESULTS.md TEST_CHECKLIST.md TESTING_INSTRUCTIONS.md TASK7_SUMMARY.md TASK7_EXECUTION_READY.md
git commit -m "test(csv): manual testing of title enrichment

- Created 4 test CSV scenarios for comprehensive testing
- Tested blank titles, mixed titles, timeouts, and non-HTML
- Verified enrichment stats display correctly
- Confirmed graceful failure handling

All tests passed. Title enrichment working as expected.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Quick Start (3 Steps)

```bash
# 1. Ensure dev server is running (already is)
npm run dev

# 2. Open browser to content page
open http://localhost:3000/content

# 3. Follow TESTING_INSTRUCTIONS.md
```

---

## Files Overview

### Essential Files for Testing

```
tiger-den/
├── test-csvs/
│   ├── scenario1-blank-titles.csv      ← Test file 1
│   ├── scenario2-mixed-titles.csv      ← Test file 2
│   ├── scenario3-slow-timeout.csv      ← Test file 3
│   ├── scenario4-non-html.csv          ← Test file 4
│   └── README.md                       ← Quick reference
│
├── TESTING_INSTRUCTIONS.md             ← 📖 START HERE (detailed guide)
├── TEST_CHECKLIST.md                   ← ✓ USE WHILE TESTING (checklist)
├── TEST_RESULTS.md                     ← 📝 UPDATE AFTER (results template)
├── TASK7_SUMMARY.md                    ← 📋 OVERVIEW (context & summary)
└── TASK7_EXECUTION_READY.md            ← 🎯 YOU ARE HERE
```

### Which Document to Use When

| When | Use This Document |
|------|-------------------|
| Planning | TASK7_SUMMARY.md |
| Before testing | TESTING_INSTRUCTIONS.md |
| During testing | TEST_CHECKLIST.md |
| After testing | TEST_RESULTS.md |
| Overview | TASK7_EXECUTION_READY.md (this file) |

---

## Expected Timeline

- **Scenario 1:** 5-10 minutes
- **Scenario 2:** 5-10 minutes
- **Scenario 3:** 10-15 minutes (includes timeouts)
- **Scenario 4:** 5-10 minutes
- **Documentation:** 5-10 minutes

**Total:** 30-55 minutes

---

## Success Criteria

All 4 scenarios must pass:

1. ✅ Scenario 1: Blank titles enriched from valid URLs
2. ✅ Scenario 2: Pre-filled titles unchanged, blank titles enriched
3. ✅ Scenario 3: Failed enrichments don't block imports
4. ✅ Scenario 4: Non-HTML content handled gracefully

**And:**
- ✅ UI shows "Fetching titles from URLs..." message
- ✅ Enrichment statistics are accurate
- ✅ No errors in browser console
- ✅ No errors in server logs

---

## Test Data Summary

| Scenario | File | Rows | Blank Titles | Pre-filled | Expected Enriched |
|----------|------|------|--------------|------------|-------------------|
| 1 | scenario1 | 3 | 3 | 0 | 3/3 |
| 2 | scenario2 | 4 | 2 | 2 | 2/2 |
| 3 | scenario3 | 3 | 3 | 0 | 1/3 (2 fail) |
| 4 | scenario4 | 3 | 2 | 1 | 1/2 (1 fails) |
| **Total** | **4 files** | **13** | **10** | **3** | **7/10** |

---

## URLs Being Tested

### Valid HTML (should succeed)
- https://en.wikipedia.org/wiki/PostgreSQL
- https://github.com/timescale/timescaledb
- https://www.anthropic.com
- https://news.ycombinator.com
- https://stackoverflow.com
- https://developer.mozilla.org
- https://www.postgresql.org
- https://www.cloudflare.com
- https://www.timescale.com

### Error Cases (should fail gracefully)
- https://httpstat.us/200?sleep=15000 (timeout)
- https://example.invalid (invalid domain)
- https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf (PDF)
- https://raw.githubusercontent.com/timescale/timescaledb/main/README.md (markdown, but pre-filled)

---

## Troubleshooting

### If imports fail
- Check browser console for errors
- Check server logs for errors
- Verify you're logged in
- Verify dev server is running

### If enrichment doesn't work
- Check network tab in browser dev tools
- Verify URLs are accessible
- Check server logs for fetch errors
- Verify title-fetcher service is working

### If pre-filled titles are changed
- This is a BUG - enrichment should skip pre-filled titles
- Document in TEST_RESULTS.md
- Check CSV file - ensure pre-filled titles are not empty

---

## Next Actions

1. **RIGHT NOW:** Open `TESTING_INSTRUCTIONS.md` and start testing
2. **WHILE TESTING:** Use `TEST_CHECKLIST.md` to track progress
3. **AFTER TESTING:** Update `TEST_RESULTS.md` with actual results
4. **IF ALL PASS:** Create commit with test results
5. **IF ANY FAIL:** Document issues and investigate

---

## Ready to Start?

✅ All test materials prepared
✅ Dev server running
✅ Documentation complete
✅ CSV files created and validated

**→ Open TESTING_INSTRUCTIONS.md and begin testing!**

---

**Prepared by:** Claude Code (Sonnet 4.5)
**Date:** 2026-02-02
**Task:** Task 7 - Test With Real URLs
**Status:** Ready for manual execution

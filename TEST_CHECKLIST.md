# Title Enrichment Test Checklist

**Date:** _______________
**Tester:** _______________

## Pre-Test Setup

- [ ] Dev server running on http://localhost:3000
- [ ] Logged in with Google OAuth
- [ ] Browser console open (F12 → Console tab)
- [ ] Terminal/server logs visible

---

## Scenario 1: Blank Titles ✓ Basic Functionality

**File:** `scenario1-blank-titles.csv`
**Expected:** 3/3 imports successful, 3/3 titles enriched

- [ ] Import started
- [ ] "Fetching titles from URLs..." message displayed
- [ ] Import completed without errors
- [ ] Result shows: "Successfully imported 3 content items"
- [ ] Result shows: "Fetched 3 of 3 titles from URLs"
- [ ] No errors in browser console
- [ ] No errors in server logs
- [ ] Content list shows 3 new items with **actual page titles** (not URLs)

**Notes:**
```



```

---

## Scenario 2: Mixed Titles ✓ Selective Enrichment

**File:** `scenario2-mixed-titles.csv`
**Expected:** 4/4 imports successful, 2/2 blank titles enriched, 2 pre-filled unchanged

- [ ] Import started
- [ ] "Fetching titles from URLs..." message displayed
- [ ] Import completed without errors
- [ ] Result shows: "Successfully imported 4 content items"
- [ ] Result shows: "Fetched 2 of 2 titles from URLs"
- [ ] No errors in browser console
- [ ] No errors in server logs
- [ ] Content list shows 4 new items
- [ ] **Verify:** "Pre-filled Title 1" is unchanged
- [ ] **Verify:** StackOverflow row has fetched title
- [ ] **Verify:** "Pre-filled Title 2" is unchanged
- [ ] **Verify:** PostgreSQL.org row has fetched title

**Notes:**
```



```

---

## Scenario 3: Timeouts ✓ Error Handling

**File:** `scenario3-slow-timeout.csv`
**Expected:** 3/3 imports successful, 1/3 enriched, 2 failures handled gracefully

⚠️ **WARNING:** This test takes 5-10 seconds due to timeouts

- [ ] Import started
- [ ] "Fetching titles from URLs..." message displayed
- [ ] Waited patiently (~10 seconds)
- [ ] Import completed without errors
- [ ] Result shows: "Successfully imported 3 content items"
- [ ] Result shows: "Fetched 1 of 3 titles from URLs. (2 failed)"
- [ ] No errors in browser console (timeouts are expected)
- [ ] No errors in server logs (timeout warnings OK)
- [ ] Content list shows 3 new items
- [ ] **Verify:** httpstat.us row shows **URL as title** (timeout fallback)
- [ ] **Verify:** example.invalid row shows **URL as title** (error fallback)
- [ ] **Verify:** Cloudflare row has **fetched title**

**Time taken:** _______ seconds

**Notes:**
```



```

---

## Scenario 4: Non-HTML ✓ Content-Type Handling

**File:** `scenario4-non-html.csv`
**Expected:** 3/3 imports successful, 1/2 blank enriched, 1 non-HTML handled

- [ ] Import started
- [ ] "Fetching titles from URLs..." message displayed
- [ ] Import completed without errors
- [ ] Result shows: "Successfully imported 3 content items"
- [ ] Result shows: "Fetched 1 of 2 titles from URLs. (1 failed)"
- [ ] No errors in browser console
- [ ] No errors in server logs
- [ ] Content list shows 3 new items
- [ ] **Verify:** PDF URL row shows **URL as title** (non-HTML fallback)
- [ ] **Verify:** Timescale.com row has **fetched title**
- [ ] **Verify:** GitHub raw markdown row shows **"Pre-filled Title"** (unchanged)

**Notes:**
```



```

---

## Overall Verification

### UI Behavior
- [ ] "Fetching titles from URLs..." message always appears during enrichment
- [ ] Enrichment statistics accurate in all scenarios
- [ ] Can close and reopen dialog for multiple imports
- [ ] Dialog UI is responsive and clear

### Data Integrity
- [ ] Blank titles enriched with page titles (when possible)
- [ ] Pre-filled titles never changed
- [ ] Failed enrichments fall back to URL as title
- [ ] All valid CSV rows imported (enrichment failures don't block)
- [ ] "Test Campaign" auto-created in campaigns list

### Error Handling
- [ ] No unexpected errors in browser console
- [ ] No unexpected errors in server logs
- [ ] Timeouts handled gracefully
- [ ] Invalid URLs handled gracefully
- [ ] Non-HTML content handled gracefully

### Performance
- [ ] Scenario 1: ~5-10 seconds
- [ ] Scenario 2: ~5-10 seconds
- [ ] Scenario 3: ~10-15 seconds (expected)
- [ ] Scenario 4: ~5-10 seconds

---

## Final Results

**Total Tests:** 4
**Passed:** _____ / 4
**Failed:** _____ / 4

**Overall Status:** [ ] PASS  [ ] FAIL

---

## Issues Found

List any bugs, unexpected behavior, or issues:

1.

2.

3.

---

## Screenshots Taken

- [ ] Import dialog during "Fetching titles..."
- [ ] Import results showing enrichment stats
- [ ] Content list showing fetched titles
- [ ] Browser console (if errors)

---

## Next Steps

- [ ] Update TEST_RESULTS.md with actual results
- [ ] Add screenshots to documentation (if taken)
- [ ] Create git commit with test results
- [ ] Clean up test data from database

---

## Commit Command (when all tests pass)

```bash
git add test-csvs/ TEST_RESULTS.md TEST_CHECKLIST.md TESTING_INSTRUCTIONS.md TASK7_SUMMARY.md
git commit -m "test(csv): manual testing of title enrichment

- Created 4 test CSV scenarios for comprehensive testing
- Tested blank titles, mixed titles, timeouts, and non-HTML
- Verified enrichment stats display correctly
- Confirmed graceful failure handling

All tests passed. Title enrichment working as expected.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

**Tester Signature:** _______________
**Date Completed:** _______________

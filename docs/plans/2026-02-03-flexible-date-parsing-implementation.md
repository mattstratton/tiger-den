# Flexible Date Format Parsing - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Accept multiple date formats during CSV import and auto-convert to YYYY-MM-DD

**Architecture:** Create date parser utility that tries 10 common formats sequentially. Integrate before Zod validation in CSV processor to normalize dates transparently.

**Tech Stack:** date-fns for date parsing, existing Zod validation, no schema changes

---

## Task 1: Install date-fns Dependency

**Files:**
- Modify: `package.json`

**Purpose:** Add date-fns library for flexible date parsing

**Step 1: Install date-fns**

Run: `npm install date-fns`

Expected: Package added to dependencies

**Step 2: Verify installation**

Run: `npm list date-fns`

Expected: Shows date-fns version installed

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add date-fns for flexible date parsing"
```

---

## Task 2: Create Date Parser Utility

**Files:**
- Create: `src/server/utils/date-parser.ts`

**Purpose:** Utility function to parse multiple date formats and return YYYY-MM-DD

**Step 1: Create utils directory if needed**

Run: `mkdir -p src/server/utils`

**Step 2: Create date parser file**

Create `src/server/utils/date-parser.ts`:

```typescript
import { parse, isValid, format } from 'date-fns';

/**
 * Parse a date string in various common formats and return YYYY-MM-DD format.
 * Tries multiple formats in priority order until one succeeds.
 *
 * @param dateString - Input date string in any supported format
 * @returns Normalized YYYY-MM-DD string, or null if unparseable
 *
 * Supported formats:
 * - YYYY-MM-DD (2024-02-15)
 * - MM/DD/YYYY (02/15/2024)
 * - M/D/YYYY (2/5/2024)
 * - MMMM D, YYYY (February 15, 2024)
 * - MMM D, YYYY (Feb 15, 2024)
 * - MMMM D. YYYY (January 20. 2026)
 * - MMM D. YYYY (Jan 20. 2026)
 * - D MMMM YYYY (15 February 2024)
 * - MM-DD-YYYY (02-15-2024)
 * - M-D-YYYY (2-5-2024)
 */
export function parseFlexibleDate(dateString: string): string | null {
  // Handle empty/null input
  if (!dateString || dateString.trim() === '') {
    return null;
  }

  const trimmed = dateString.trim();

  // Format strings in priority order
  // Most common formats first for performance
  const formats = [
    'yyyy-MM-dd',      // 2024-02-15 (current format)
    'MM/dd/yyyy',      // 02/15/2024 (US format)
    'M/d/yyyy',        // 2/5/2024 (US short)
    'MMMM d, yyyy',    // February 15, 2024
    'MMM d, yyyy',     // Feb 15, 2024
    'MMMM d. yyyy',    // January 20. 2026
    'MMM d. yyyy',     // Jan 20. 2026
    'd MMMM yyyy',     // 15 February 2024 (international)
    'MM-dd-yyyy',      // 02-15-2024 (dashes)
    'M-d-yyyy',        // 2-5-2024 (short dashes)
  ];

  // Try each format until one succeeds
  for (const formatString of formats) {
    try {
      const parsed = parse(trimmed, formatString, new Date());

      // Check if the parsed date is valid
      if (isValid(parsed)) {
        // Return in YYYY-MM-DD format
        return format(parsed, 'yyyy-MM-dd');
      }
    } catch {
      // Try next format
      continue;
    }
  }

  // No format matched
  return null;
}
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
git add src/server/utils/date-parser.ts
git commit -m "feat(csv): add flexible date parser utility

- Supports 10 common date formats
- Returns normalized YYYY-MM-DD string
- Returns null if unparseable"
```

---

## Task 3: Integrate Date Parser into CSV Processor

**Files:**
- Modify: `src/server/services/csv-processor.ts`

**Purpose:** Normalize dates before validation

**Step 1: Add import**

At the top of `src/server/services/csv-processor.ts`, add:

```typescript
import { parseFlexibleDate } from "~/server/utils/date-parser";
```

**Step 2: Find the validation loop**

Locate the code that validates each row (around line 150-160):

```typescript
// Validate row
const validatedRow = csvRowSchema.parse(row);
```

**Step 3: Add date normalization before validation**

Replace the validation line with:

```typescript
// Normalize date format if present
if (row.publish_date && typeof row.publish_date === 'string') {
  const parsedDate = parseFlexibleDate(row.publish_date);
  if (parsedDate) {
    row.publish_date = parsedDate;
  }
  // If parsedDate is null, leave original value for Zod to catch
}

// Validate row
const validatedRow = csvRowSchema.parse(row);
```

**Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No errors

**Step 5: Test with existing CSV**

Run: `npm run dev`

Test: Upload a CSV with YYYY-MM-DD dates

Expected: Import succeeds, no behavior change

**Step 6: Commit**

```bash
git add src/server/services/csv-processor.ts
git commit -m "feat(csv): integrate flexible date parsing

- Normalize publish_date before validation
- Backward compatible with YYYY-MM-DD
- Invalid dates caught by Zod validation"
```

---

## Task 4: Create Test CSV with Various Date Formats

**Files:**
- Create: `test-csvs/flexible-dates.csv`

**Purpose:** Test file with all supported date formats

**Step 1: Create test CSV**

Create `test-csvs/flexible-dates.csv`:

```csv
title,current_url,content_type,publish_date,description,author,target_audience,campaigns,tags
Current Format,https://example.com/test-1,blog_post,2024-02-15,YYYY-MM-DD format,Test Author,developers,Test Campaign,test
US Slash,https://example.com/test-2,blog_post,02/15/2024,MM/DD/YYYY format,Test Author,developers,Test Campaign,test
US Short Slash,https://example.com/test-3,blog_post,2/5/2024,M/D/YYYY format,Test Author,developers,Test Campaign,test
Written Full,https://example.com/test-4,blog_post,February 15 2024,Full month name,Test Author,developers,Test Campaign,test
Written Short,https://example.com/test-5,blog_post,Feb 15 2024,Short month name,Test Author,developers,Test Campaign,test
Period Full,https://example.com/test-6,blog_post,January 20. 2026,Full month with period,Test Author,developers,Test Campaign,test
Period Short,https://example.com/test-7,blog_post,Jan 20. 2026,Short month with period,Test Author,developers,Test Campaign,test
International,https://example.com/test-8,blog_post,15 February 2024,Day first format,Test Author,developers,Test Campaign,test
Dash Format,https://example.com/test-9,blog_post,02-15-2024,MM-DD-YYYY dashes,Test Author,developers,Test Campaign,test
Empty Date,https://example.com/test-10,blog_post,,Optional field empty,Test Author,developers,Test Campaign,test
Invalid Date,https://example.com/test-11,blog_post,02/31/2024,Should fail validation,Test Author,developers,Test Campaign,test
```

**Step 2: Commit**

```bash
git add test-csvs/flexible-dates.csv
git commit -m "test(csv): add flexible date formats test file

- Tests all 10 supported formats
- Includes edge cases (empty, invalid)
- Expected: 10 success, 1 validation error"
```

---

## Task 5: Manual Testing

**Files:**
- None (testing task)

**Purpose:** Verify all date formats work correctly

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Navigate to import page**

Navigate to: `http://localhost:3000/content` (or `http://localhost:3001` if port 3000 in use)

**Step 3: Import test CSV**

1. Click "Import CSV" button
2. Upload `test-csvs/flexible-dates.csv`
3. Wait for import to complete

**Step 4: Verify results**

Expected results:
- **10 rows imported successfully**
- **1 row failed** (Invalid Date with 02/31/2024)
- Error message: "Date must be in YYYY-MM-DD format" for row 11

**Step 5: Verify dates in database**

In the content list, check that dates display correctly:
- All dates should show in consistent format
- US dates (02/15/2024) should be Feb 15, 2024
- Written dates (February 15, 2024) should match
- No dates should be off by a month or day

**Step 6: Test with real CSV**

If you have a real CSV with various date formats:
1. Upload it
2. Verify dates are parsed correctly
3. Check for any unexpected errors

**Step 7: Document results**

If testing was successful, proceed. If any issues found, fix before continuing.

---

## Task 6: Update Documentation

**Files:**
- Modify: `FOLLOW-UP.md`
- Modify: `test-csvs/README.md` (optional)

**Purpose:** Mark feature as completed

**Step 1: Update FOLLOW-UP.md**

Find the "Flexible Date Format Parsing" section under "CSV Import Improvements" and move it to "Completed Features":

Remove from CSV Import Improvements:
```markdown
### 2. Flexible Date Format Parsing
**Priority:** Medium
**Description:** Accept and convert standard date formats during CSV import
...
```

Add to Completed Features section (after Metadata Enrichment):
```markdown
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
```

**Step 2: Update test-csvs README (optional)**

Add to `test-csvs/README.md`:

```markdown
## Flexible Date Format Testing

### flexible-dates.csv (11 rows)
- Tests all 10 supported date formats
- Includes edge cases: empty date, invalid date
- Expected: 10 successful imports, 1 validation error (invalid date)
- Verifies date normalization to YYYY-MM-DD format
```

**Step 3: Commit**

```bash
git add FOLLOW-UP.md test-csvs/README.md
git commit -m "docs: mark flexible date parsing as completed

- Move from pending to completed in FOLLOW-UP.md
- Document supported formats
- Update test CSV documentation"
```

---

## Task 7: Deploy to Production and Verify

**Files:**
- None (deployment task)

**Purpose:** Deploy and verify in production

**Step 1: Ensure all changes committed**

Run: `git status`

Expected: Working tree clean

**Step 2: Push to GitHub**

Run: `git push origin main`

Expected: Push successful

**Step 3: Verify Vercel deployment**

Wait for Vercel to deploy automatically (1-2 minutes)

**Step 4: Test in production**

1. Navigate to: `https://tiger-den.vercel.app`
2. Sign in
3. Go to content page
4. Import `test-csvs/flexible-dates.csv`
5. Verify 10 rows import successfully
6. Verify 1 row fails with validation error

**Step 5: Test with real CSV**

If you have a real CSV with various date formats:
1. Upload to production
2. Verify dates parse correctly
3. Check imported dates in database

**Step 6: Monitor for issues**

Check for any error reports or user feedback over next few days

---

## Summary

**Total Tasks:** 7
**Estimated Time:** 30-45 minutes

**Key Files Modified:**
- `package.json` (new dependency)
- `src/server/utils/date-parser.ts` (new)
- `src/server/services/csv-processor.ts` (modified)
- `test-csvs/flexible-dates.csv` (new)
- `FOLLOW-UP.md` (updated)

**Dependencies Added:**
- `date-fns` (date parsing library)

**Testing:**
- Manual testing with test CSV (10 formats)
- Production verification
- Real CSV testing

**Success Criteria:**
- ✅ All 10 date formats parse correctly
- ✅ Invalid dates show clear errors
- ✅ Backward compatible with YYYY-MM-DD
- ✅ No performance degradation
- ✅ Production deployment successful

---

*Implementation plan complete: 2026-02-03*

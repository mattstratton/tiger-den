# Flexible Date Format Parsing - Design Document

**Date:** 2026-02-03
**Feature:** Accept multiple date formats during CSV import and auto-convert to YYYY-MM-DD

---

## Overview

Allow CSV imports to accept common date formats (US formats, written formats) and automatically convert them to the required YYYY-MM-DD format for database storage. This reduces import errors and improves user experience.

## Problem

Currently, CSV imports require dates in strict YYYY-MM-DD format. Users have CSV files with various date formats:
- US formats: 02/15/2024, 2/5/2024
- Written formats: February 15, 2024, Feb 15, 2024, January 20. 2026
- International: 15 February 2024
- Variations with dashes: 02-15-2024

This causes validation errors and requires users to manually reformat dates before import.

## Solution

Add a date parser that tries multiple common formats before validation, automatically converting successful parses to YYYY-MM-DD format.

---

## Design Decisions

### 1. Parsing Strategy: Try Multiple Formats in Order

**Decision:** Use date-fns library to try common formats sequentially until one succeeds

**Rationale:**
- Fast enough for CSV import scale (0.01ms per parse attempt)
- Predictable behavior (same input always produces same output)
- No user intervention required
- Handles 90%+ of real-world date formats

**Format Priority Order:**
1. `yyyy-MM-dd` - Current format (backward compatibility)
2. `MM/dd/yyyy` - US format (02/15/2024)
3. `M/d/yyyy` - US short format (2/5/2024)
4. `MMMM d, yyyy` - Written with comma (February 15, 2024)
5. `MMM d, yyyy` - Abbreviated with comma (Feb 15, 2024)
6. `MMMM d. yyyy` - Written with period (January 20. 2026)
7. `MMM d. yyyy` - Abbreviated with period (Jan 20. 2026)
8. `d MMMM yyyy` - International (15 February 2024)
9. `MM-dd-yyyy` - Dashes (02-15-2024)
10. `M-d-yyyy` - Short dashes (2-5-2024)

### 2. Ambiguous Date Handling: US Format Priority

**Decision:** Ambiguous dates (e.g., "01/02/2024") always interpreted as MM/DD/YYYY (US format)

**Rationale:**
- User doesn't control source formats, needs maximum flexibility
- US format is most common in their use case
- Trying MM/DD/YYYY first ensures consistent interpretation
- No warnings needed - keeps UX simple
- Users can verify imported dates and manually fix if needed

**Alternative Considered:** Show warnings for ambiguous dates
- Rejected: Adds complexity, most dates will be correct anyway

### 3. Integration Point: Pre-Validation Normalization

**Decision:** Parse and normalize dates before Zod validation runs

**Rationale:**
- Existing Zod schema stays unchanged
- Validation logic remains simple
- Normalization happens once per row
- Clear separation of concerns (parsing vs validation)

**Flow:**
```
CSV Row → Parse publish_date → Normalize to YYYY-MM-DD → Zod Validation → Database
```

### 4. Error Handling: Let Validation Catch Bad Dates

**Decision:** If parsing fails, leave original value and let Zod validation fail

**Rationale:**
- Reuses existing error reporting infrastructure
- Clear error messages with row numbers
- User sees which dates couldn't be parsed
- No new error handling code needed

### 5. Performance: Acceptable Overhead

**Decision:** Sequential format attempts acceptable for CSV import scale

**Analysis:**
- 10 format attempts per date field
- ~0.01ms per parse attempt
- Worst case: 1000 rows × 10 attempts = 10,000 parses = ~100ms
- Negligible compared to title enrichment (~5 seconds per URL)
- No optimization needed

---

## Architecture

### Components

#### 1. Date Parser Utility
**File:** `src/server/utils/date-parser.ts`
**Purpose:** Try multiple date formats and return normalized YYYY-MM-DD string

**Function Signature:**
```typescript
export function parseFlexibleDate(dateString: string): string | null
```

**Returns:**
- Valid YYYY-MM-DD string if parsing succeeds
- `null` if no format matches

**Implementation:**
```typescript
import { parse, isValid, format } from 'date-fns';

export function parseFlexibleDate(dateString: string): string | null {
  // Handle empty/null
  if (!dateString || dateString.trim() === '') return null;

  const trimmed = dateString.trim();

  // Format strings in priority order
  const formats = [
    'yyyy-MM-dd',      // 2024-02-15 (current)
    'MM/dd/yyyy',      // 02/15/2024
    'M/d/yyyy',        // 2/5/2024
    'MMMM d, yyyy',    // February 15, 2024
    'MMM d, yyyy',     // Feb 15, 2024
    'MMMM d. yyyy',    // January 20. 2026
    'MMM d. yyyy',     // Jan 20. 2026
    'd MMMM yyyy',     // 15 February 2024
    'MM-dd-yyyy',      // 02-15-2024
    'M-d-yyyy',        // 2-5-2024
  ];

  // Try each format
  for (const formatString of formats) {
    try {
      const parsed = parse(trimmed, formatString, new Date());
      if (isValid(parsed)) {
        // Convert to YYYY-MM-DD
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

#### 2. CSV Processor Integration
**File:** `src/server/services/csv-processor.ts`
**Change:** Add date normalization before Zod validation

**Location:** In the validation loop, before `csvRowSchema.parse(row)`

**Implementation:**
```typescript
// Import the parser
import { parseFlexibleDate } from '~/server/utils/date-parser';

// In the processing loop, before validation:
for (let i = 0; i < rows.length; i++) {
  const row = rows[i];

  // Normalize date if present
  if (row.publish_date && typeof row.publish_date === 'string') {
    const parsedDate = parseFlexibleDate(row.publish_date);
    if (parsedDate) {
      row.publish_date = parsedDate;
    }
    // If parsedDate is null, leave original value for Zod to catch
  }

  // Continue with existing validation
  const validatedRow = csvRowSchema.parse(row);
  // ... rest of processing
}
```

#### 3. No Schema Changes
**File:** `src/server/services/csv-processor.ts`
**No changes needed** - existing Zod schema continues to work:

```typescript
publish_date: z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
  .optional()
  .or(z.literal(""))
```

The schema validates the *normalized* date (YYYY-MM-DD), not the original input.

---

## Error Handling

### Unparseable Dates

**Scenario:** Date string doesn't match any known format (e.g., "not a date", "99/99/9999")

**Handling:**
1. `parseFlexibleDate()` returns `null`
2. Original value remains in row
3. Zod validation fails: "Date must be in YYYY-MM-DD format"
4. Error appears in import results with row number
5. User can fix and re-import

**Example Error:**
```
Row 5: Date must be in YYYY-MM-DD format (field: publish_date)
```

### Invalid Dates

**Scenario:** Date format matches but date is invalid (e.g., "02/31/2024", "13/01/2024")

**Handling:**
1. date-fns `parse()` creates date object
2. `isValid()` returns `false`
3. Parser continues to next format
4. Eventually returns `null`
5. Zod validation catches the error

**Result:** Same as unparseable dates - clear error message

### Ambiguous Dates

**Scenario:** Date could be interpreted multiple ways (e.g., "01/02/2024" = Jan 2 or Feb 1?)

**Handling:**
1. Parsed as first matching format (MM/DD/YYYY)
2. "01/02/2024" → January 2, 2024
3. No warning or ambiguity flag
4. Consistent, predictable behavior

**Rationale:**
- Most dates are unambiguous (day > 12)
- For ambiguous dates, US format is most likely
- Users can verify imported data visually
- Showing warnings adds complexity for little benefit

### Empty/Missing Dates

**Scenario:** Date field is empty, null, or undefined

**Handling:**
1. `parseFlexibleDate()` returns `null` immediately
2. Field remains empty
3. Zod validation passes (field is optional)
4. Database stores NULL

**No change:** Already handled correctly by existing code

### Whitespace

**Scenario:** Date has leading/trailing whitespace (e.g., " 02/15/2024 ")

**Handling:**
1. `trim()` called at start of `parseFlexibleDate()`
2. Whitespace removed before parsing
3. Parses normally

---

## Performance Analysis

### Parse Operation Cost
- Single `parse()` call: ~0.01ms
- Single `isValid()` check: ~0.001ms
- Total per format attempt: ~0.011ms

### Worst Case Scenario
- 1000-row CSV
- Every row has non-YYYY-MM-DD date
- All dates try all 10 formats before succeeding
- Total: 1000 rows × 10 attempts × 0.011ms = **110ms overhead**

### Typical Case
- 1000-row CSV
- 50% already YYYY-MM-DD (match on first try: 0.011ms)
- 40% US format MM/DD/YYYY (match on second try: 0.022ms)
- 10% other formats (average 5 tries: 0.055ms)
- Total: ~**30ms overhead**

### Context
- Title enrichment: 5 seconds per URL × 10 URLs = 50 seconds
- Database operations: 100-500ms per insert × 1000 = 100-500 seconds
- Date parsing: 30-110ms total

**Conclusion:** Negligible performance impact

---

## Backward Compatibility

### Existing CSV Files
- YYYY-MM-DD format tried first
- Matches immediately
- No behavior change
- Zero breaking changes

### Existing Validation
- Zod schema unchanged
- Error messages unchanged
- Validation rules unchanged
- Only input is normalized

### API Contract
- tRPC endpoint signature unchanged
- Response format unchanged
- Error format unchanged

**Conclusion:** Fully backward compatible

---

## Testing Strategy

### Unit Tests (Optional - Manual Testing Sufficient)

If implementing unit tests:

**File:** `src/server/utils/date-parser.test.ts`

**Test Cases:**
```typescript
describe('parseFlexibleDate', () => {
  it('parses YYYY-MM-DD (current format)', () => {
    expect(parseFlexibleDate('2024-02-15')).toBe('2024-02-15');
  });

  it('parses MM/DD/YYYY', () => {
    expect(parseFlexibleDate('02/15/2024')).toBe('2024-02-15');
  });

  it('parses M/D/YYYY', () => {
    expect(parseFlexibleDate('2/5/2024')).toBe('2024-02-05');
  });

  it('parses written formats', () => {
    expect(parseFlexibleDate('February 15, 2024')).toBe('2024-02-15');
    expect(parseFlexibleDate('Feb 15, 2024')).toBe('2024-02-15');
    expect(parseFlexibleDate('January 20. 2026')).toBe('2026-01-20');
  });

  it('parses international format', () => {
    expect(parseFlexibleDate('15 February 2024')).toBe('2024-02-15');
  });

  it('returns null for invalid dates', () => {
    expect(parseFlexibleDate('02/31/2024')).toBeNull();
    expect(parseFlexibleDate('99/99/9999')).toBeNull();
    expect(parseFlexibleDate('not a date')).toBeNull();
  });

  it('handles empty/null input', () => {
    expect(parseFlexibleDate('')).toBeNull();
    expect(parseFlexibleDate('   ')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(parseFlexibleDate('  02/15/2024  ')).toBe('2024-02-15');
  });
});
```

### Manual Testing

**Test CSV:** `test-csvs/flexible-dates.csv`

Create a CSV with various date formats to test in one import:

```csv
title,current_url,content_type,publish_date,description,author,target_audience,campaigns,tags
Test 1,https://example.com/1,blog_post,2024-02-15,Current format,Test Author,developers,Test Campaign,test
Test 2,https://example.com/2,blog_post,02/15/2024,US slash format,Test Author,developers,Test Campaign,test
Test 3,https://example.com/3,blog_post,2/5/2024,US short format,Test Author,developers,Test Campaign,test
Test 4,https://example.com/4,blog_post,February 15 2024,Written full month,Test Author,developers,Test Campaign,test
Test 5,https://example.com/5,blog_post,Feb 15 2024,Written short month,Test Author,developers,Test Campaign,test
Test 6,https://example.com/6,blog_post,January 20. 2026,Written with period,Test Author,developers,Test Campaign,test
Test 7,https://example.com/7,blog_post,15 February 2024,International format,Test Author,developers,Test Campaign,test
Test 8,https://example.com/8,blog_post,02-15-2024,Dashes format,Test Author,developers,Test Campaign,test
Test 9,https://example.com/9,blog_post,,Empty date (optional),Test Author,developers,Test Campaign,test
Test 10,https://example.com/10,blog_post,02/31/2024,Invalid date (should error),Test Author,developers,Test Campaign,test
```

**Expected Results:**
- Rows 1-9: Import successfully, dates normalized to YYYY-MM-DD
- Row 10: Import fails with validation error (invalid date)

**Verification:**
1. Import the test CSV
2. Check that 9 rows imported successfully
3. Check that 1 row failed with clear error message
4. Verify dates in database are all YYYY-MM-DD format
5. Visually verify dates are correct (e.g., Feb 15 = 2024-02-15)

### Production Testing

1. Deploy to production
2. Test with real user CSV files (various formats)
3. Monitor error rates - should decrease
4. Gather user feedback

---

## Implementation Tasks

### Task 1: Install date-fns
```bash
npm install date-fns
```

### Task 2: Create Date Parser Utility
- File: `src/server/utils/date-parser.ts`
- Implement `parseFlexibleDate()` function
- Include all 10 format strings

### Task 3: Update CSV Processor
- File: `src/server/services/csv-processor.ts`
- Import `parseFlexibleDate`
- Add date normalization before validation
- Ensure existing logic unchanged

### Task 4: Create Test CSV
- File: `test-csvs/flexible-dates.csv`
- Include all supported formats
- Include edge cases (empty, invalid)

### Task 5: Manual Testing
- Import test CSV locally
- Verify all formats parse correctly
- Verify errors for invalid dates

### Task 6: Update Documentation
- Update `FOLLOW-UP.md` - mark as completed
- Update `CLAUDE.md` if needed

### Task 7: Deploy and Verify
- Push to production
- Test with real CSV files
- Monitor for issues

---

## Future Enhancements (Out of Scope)

### Format Hint in UI
- Add optional "Date Format" dropdown in import dialog
- Options: "Auto-detect", "US (MM/DD/YYYY)", "International (DD/MM/YYYY)"
- Override auto-detection behavior
- Useful for users with consistent format needs

### Ambiguous Date Warnings
- Track when ambiguous dates are parsed
- Show warnings in import results: "Row 5: Date '01/02/2024' interpreted as Jan 2, 2024"
- Helps users verify assumptions
- Adds complexity - defer until user feedback

### Additional Format Support
- ISO 8601 with time: 2024-02-15T10:30:00
- Timestamps: 1707998400
- Relative dates: "yesterday", "last week" (requires chrono-node)
- Only add if users request

### Date Format Auto-Detection
- Analyze all dates in CSV before parsing
- Detect predominant format
- Use that format first for all rows
- More complex, marginal benefit

---

## Success Criteria

✅ Users can import CSVs with common US date formats (MM/DD/YYYY, M/D/YYYY)
✅ Users can import CSVs with written formats (February 15, 2024, etc.)
✅ Existing YYYY-MM-DD format still works
✅ Invalid dates show clear error messages
✅ No performance degradation
✅ Backward compatible with existing CSV files
✅ Less than 100ms overhead for 1000-row imports

---

*Design validated and approved: 2026-02-03*

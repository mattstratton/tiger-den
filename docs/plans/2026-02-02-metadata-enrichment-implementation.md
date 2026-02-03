# Metadata Enrichment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-fetch page titles from URLs during CSV import when the title field is blank.

**Architecture:** Add a title fetcher service that uses native fetch with timeout to extract `<title>` tags from HTML. Integrate into CSV import router to enrich rows before validation. Update UI to show enrichment progress and results.

**Tech Stack:** Next.js 16, TypeScript, tRPC, cheerio (HTML parsing), native fetch API

---

## Task 1: Install cheerio Dependency

**Files:**
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/package.json`

**Step 1: Install cheerio package**

Run: `npm install cheerio`
Expected: cheerio added to dependencies in package.json

**Step 2: Install cheerio TypeScript types**

Run: `npm install -D @types/cheerio`
Expected: @types/cheerio added to devDependencies

**Step 3: Verify installation**

Run: `npm list cheerio @types/cheerio`
Expected: Both packages listed with version numbers

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install cheerio for HTML parsing

Add cheerio library to parse HTML and extract page titles during CSV import enrichment."
```

---

## Task 2: Create Title Fetcher Service

**Files:**
- Create: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/server/services/title-fetcher.ts`

**Step 1: Create services directory**

Run: `mkdir -p /Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/server/services`
Expected: Directory created

**Step 2: Create title fetcher service file**

Create: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/server/services/title-fetcher.ts`

```typescript
import * as cheerio from "cheerio";

/**
 * Fetches a webpage and extracts the title from the HTML <title> tag.
 *
 * @param url - The URL to fetch
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns The page title string, or null if fetch fails or no title found
 */
export async function fetchPageTitle(
  url: string,
  timeoutMs = 5000
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Fetch the URL with timeout
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TigerDen-MetadataBot/1.0",
      },
    });

    // Check if response is OK
    if (!response.ok) {
      return null;
    }

    // Check if content is HTML
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("text/html")) {
      return null;
    }

    // Parse HTML and extract title
    const html = await response.text();
    const $ = cheerio.load(html);
    const title = $("title").text().trim();

    // Return title or null if empty
    return title || null;
  } catch (error) {
    // Timeout, network error, parsing error, etc.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
```

**Step 3: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 4: Commit**

```bash
git add src/server/services/title-fetcher.ts
git commit -m "feat: add title fetcher service

Create service to fetch webpage titles from URLs with 5-second timeout. Returns null on any failure (timeout, network error, non-HTML content)."
```

---

## Task 3: Update CSV Row Schema

**Files:**
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/server/api/routers/csv.ts:8`

**Step 1: Make title optional in CSV schema**

In `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/server/api/routers/csv.ts`, change line 8 from:

```typescript
title: z.string().min(1, "Title is required"),
```

To:

```typescript
title: z.string().optional().or(z.literal("")),
```

This allows blank titles to pass validation since they will be enriched before import.

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/server/api/routers/csv.ts
git commit -m "feat: make CSV title field optional for enrichment

Allow blank titles in CSV import schema since they will be auto-filled from URLs during metadata enrichment."
```

---

## Task 4: Add Enrichment Logic to CSV Router

**Files:**
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/server/api/routers/csv.ts:1,36-173`

**Step 1: Import title fetcher service**

Add import at the top of the file (after existing imports):

```typescript
import { fetchPageTitle } from "~/server/services/title-fetcher";
```

**Step 2: Update import mutation return type**

Add enrichment stats to the return type. After the `ImportError` interface (around line 34), add:

```typescript
interface EnrichmentStats {
  attempted: number;
  successful: number;
  failed: number;
}
```

**Step 3: Add enrichment loop before validation**

In the `import` mutation (around line 43), add enrichment logic after initializing variables but before the validation loop:

```typescript
export const csvRouter = createTRPCRouter({
  import: protectedProcedure
    .input(
      z.object({
        rows: z.array(z.record(z.string(), z.unknown())),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let successful = 0;
      let failed = 0;
      const errors: ImportError[] = [];
      const processedUrls = new Set<string>();

      // ENRICHMENT PHASE: Fetch titles for blank title fields
      const enrichmentStats: EnrichmentStats = {
        attempted: 0,
        successful: 0,
        failed: 0,
      };

      for (const row of input.rows) {
        // Check if title is blank and URL exists
        const titleIsBlank = !row.title || (typeof row.title === 'string' && row.title.trim() === '');
        const hasUrl = typeof row.current_url === 'string' && row.current_url.trim() !== '';

        if (titleIsBlank && hasUrl) {
          enrichmentStats.attempted++;

          try {
            const fetchedTitle = await fetchPageTitle(row.current_url as string);

            if (fetchedTitle) {
              row.title = fetchedTitle;
              enrichmentStats.successful++;
            } else {
              enrichmentStats.failed++;
            }
          } catch {
            enrichmentStats.failed++;
          }
        }
      }

      // Continue with existing validation and import logic...
      // (keep all existing code for validation loop)
```

**Step 4: Update return statement**

At the end of the mutation (around line 169), update the return statement to include enrichment stats:

```typescript
      return {
        successful,
        failed,
        errors,
        enrichment: enrichmentStats,
      };
    }),
});
```

**Step 5: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 6: Commit**

```bash
git add src/server/api/routers/csv.ts
git commit -m "feat: add metadata enrichment to CSV import

Automatically fetch page titles from URLs when title field is blank during CSV import. Uses 5-second timeout per fetch. Returns enrichment statistics in import results."
```

---

## Task 5: Update Import Dialog UI - Types and State

**Files:**
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/app/content/_components/import-csv-dialog.tsx:23-35,57-113`

**Step 1: Add enrichment stats to ImportResult interface**

Update the `ImportResult` interface (around line 23):

```typescript
interface ImportResult {
  successful: number;
  failed: number;
  errors: Array<{
    row: number;
    message: string;
    field?: string;
  }>;
  enrichment?: {
    attempted: number;
    successful: number;
    failed: number;
  };
}
```

**Step 2: Add enriching state**

Add enriching state to the component (around line 34):

```typescript
export function ImportCsvDialog({ open, onOpenChange }: ImportCsvDialogProps) {
  const [importing, setImporting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
```

**Step 3: Update onDrop callback to set enriching state**

In the `onDrop` callback (around line 62), update the state management:

```typescript
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setImporting(false);
      setEnriching(true); // Set enriching state
      setResult(null);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          // Parse the CSV data
          const rows = results.data as Array<Record<string, unknown>>;

          if (rows.length === 0) {
            setResult({
              successful: 0,
              failed: 0,
              errors: [{ row: 0, message: "CSV file is empty" }],
            });
            setEnriching(false);
            setImporting(false);
            return;
          }

          // Check row count limit
          if (rows.length > 1000) {
            setResult({
              successful: 0,
              failed: 0,
              errors: [
                {
                  row: 0,
                  message:
                    "CSV exceeds 1000 row limit. Please split into smaller files.",
                },
              ],
            });
            setEnriching(false);
            setImporting(false);
            return;
          }

          // Set importing state before mutation
          setEnriching(false);
          setImporting(true);

          // Call the import mutation
          importMutation.mutate({ rows });
        },
        error: (error) => {
          setResult({
            successful: 0,
            failed: 1,
            errors: [{ row: 0, message: `Failed to parse CSV: ${error.message}` }],
          });
          setEnriching(false);
          setImporting(false);
        },
      });
    },
    [importMutation]
  );
```

**Step 4: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/app/content/_components/import-csv-dialog.tsx
git commit -m "feat: add enrichment state to import dialog

Add enrichment stats to result type and enriching state to track title fetching phase."
```

---

## Task 6: Update Import Dialog UI - Display Enrichment Status

**Files:**
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/app/content/_components/import-csv-dialog.tsx:240-262,265-313`

**Step 1: Update dropzone display to show enriching state**

Update the dropzone section (around line 240) to show different message when enriching:

```typescript
          {/* Dropzone */}
          {!result && (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
                transition-colors
                ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
                ${importing || enriching ? "opacity-50 cursor-not-allowed" : "hover:border-primary hover:bg-primary/5"}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              {enriching ? (
                <>
                  <p className="text-lg font-medium">Fetching titles from URLs...</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    This may take a few moments
                  </p>
                </>
              ) : importing ? (
                <p className="text-lg font-medium">Importing content items...</p>
              ) : isDragActive ? (
                <p className="text-lg font-medium">Drop the CSV file here</p>
              ) : (
                <>
                  <p className="text-lg font-medium mb-2">
                    Drag and drop a CSV file here
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to select a file
                  </p>
                </>
              )}
            </div>
          )}
```

**Step 2: Add enrichment results display**

Add enrichment summary after the success/error alerts (around line 290):

```typescript
          {/* Import Results */}
          {result && (
            <div className="space-y-4">
              {/* Success Alert */}
              {result.successful > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Import Successful</AlertTitle>
                  <AlertDescription>
                    Successfully imported {result.successful} content{" "}
                    {result.successful === 1 ? "item" : "items"}.
                  </AlertDescription>
                </Alert>
              )}

              {/* Enrichment Summary */}
              {result.enrichment && result.enrichment.attempted > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Title Enrichment</AlertTitle>
                  <AlertDescription>
                    Automatically fetched {result.enrichment.successful} of{" "}
                    {result.enrichment.attempted} titles from URLs.
                    {result.enrichment.failed > 0 &&
                      ` (${result.enrichment.failed} fetch ${result.enrichment.failed === 1 ? "failed" : "failures"})`}
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Alert */}
              {result.failed > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Import Errors</AlertTitle>
                  <AlertDescription>
                    Failed to import {result.failed} content{" "}
                    {result.failed === 1 ? "item" : "items"}.
                  </AlertDescription>
                </Alert>
              )}
```

**Step 3: Update handleClose and reset to clear enriching state**

Update the `handleClose` function and the "Import Another File" button reset:

```typescript
  const handleClose = () => {
    setResult(null);
    setEnriching(false);
    setImporting(false);
    onOpenChange(false);
  };

  // In the "Import Another File" button onClick:
  <Button
    onClick={() => {
      setResult(null);
      setImporting(false);
      setEnriching(false);
    }}
  >
    Import Another File
  </Button>
```

**Step 4: Update dropzone disabled state**

Update the dropzone configuration (around line 122) to disable during enriching:

```typescript
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
    multiple: false,
    disabled: importing || enriching, // Disable during both phases
    maxSize: 5 * 1024 * 1024, // 5MB
```

**Step 5: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: No TypeScript errors

**Step 6: Test UI locally**

Run: `npm run dev`
Open: http://localhost:3000/content
Test: Upload a CSV and verify enrichment messages display

**Step 7: Commit**

```bash
git add src/app/content/_components/import-csv-dialog.tsx
git commit -m "feat: display enrichment status in import dialog

Show 'Fetching titles from URLs...' message during enrichment phase. Display enrichment summary in import results showing successful/failed title fetches."
```

---

## Task 7: Test with Real URLs

**Files:**
- Create test CSV file

**Step 1: Create test CSV file**

Create a test CSV file with blank titles:

```csv
title,current_url,content_type,publish_date,description,author,target_audience,tags,campaigns
,https://en.wikipedia.org/wiki/TypeScript,blog_post,2026-02-02,Test article,Test Author,Developers,typescript,Q1 2026
Sample Title,https://example.com/test,blog_post,2026-02-02,Has title provided,Test Author,Developers,test,Q1 2026
,https://github.com/nextauthjs/next-auth,website_content,2026-02-02,Should fetch title,Test Author,Developers,nextauth,Q1 2026
,https://this-domain-does-not-exist-12345.com,blog_post,2026-02-02,Should fail gracefully,Test Author,Developers,test,Q1 2026
```

Save as `test-enrichment.csv`

**Step 2: Test import with enrichment**

1. Run: `npm run dev`
2. Navigate to: http://localhost:3000/content
3. Click "Import CSV"
4. Upload `test-enrichment.csv`
5. Observe:
   - "Fetching titles from URLs..." message displays
   - Import completes
   - Enrichment summary shows: "Automatically fetched X of Y titles from URLs"
   - Content items created with fetched titles

**Step 3: Verify results in content list**

Check that:
- Row 1: Title fetched from Wikipedia (should be "TypeScript - Wikipedia")
- Row 2: Original title "Sample Title" preserved
- Row 3: Title fetched from GitHub
- Row 4: Title remains blank (fetch failed for non-existent domain)

**Step 4: Document test results**

Note any issues or unexpected behavior for refinement.

---

## Task 8: Update Documentation

**Files:**
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/README.md`
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/FOLLOW-UP.md`

**Step 1: Update README with enrichment feature**

In the README.md, find the CSV Import section and add enrichment information:

```markdown
### CSV Import
- Import content from CSV with validation
- Auto-create campaigns during import
- Skip invalid rows with error reporting
- **Auto-fetch titles**: Leave title field blank to automatically fetch from URL (5-second timeout)
- Export filtered content to CSV
- Template download
```

**Step 2: Update FOLLOW-UP.md to mark enrichment as completed**

In FOLLOW-UP.md, move the metadata enrichment item from "Other Features" to a "Completed Features" section:

```markdown
## Completed Features

### Metadata Enrichment ✅
**Completed:** 2026-02-02
**Description:** Auto-fetch page titles from URLs during CSV import when title field is blank
**Implementation:**
- Fetches HTML title tags with 5-second timeout
- Shows enrichment progress during import
- Displays enrichment summary in results
- Gracefully handles failures (leaves title blank)
```

**Step 3: Commit**

```bash
git add README.md FOLLOW-UP.md
git commit -m "docs: document metadata enrichment feature

Update README to mention auto-fetch titles feature. Mark metadata enrichment as completed in FOLLOW-UP.md."
```

---

## Task 9: Deploy to Vercel and Test

**Files:**
- None (deployment task)

**Step 1: Push changes to GitHub**

Run: `git push origin main`
Expected: All commits pushed to remote

**Step 2: Verify Vercel deployment**

- Check Vercel dashboard for automatic deployment
- Wait for build to complete
- Verify deployment succeeds

**Step 3: Test on production**

1. Go to: https://tiger-den.vercel.app/content
2. Sign in with Google
3. Test CSV import with blank titles
4. Verify enrichment works on production
5. Check enrichment summary displays correctly

**Step 4: Test with various URL types**

Test CSV with:
- Valid URLs (news sites, Wikipedia)
- Slow URLs (may timeout)
- Invalid URLs (should fail gracefully)
- Non-HTML URLs (PDFs - should fail gracefully)

**Step 5: Document any production issues**

If any issues occur on Vercel, document them for follow-up.

---

## Post-Implementation Notes

**What Was Built:**
- Title fetcher service with 5-second timeout and error handling
- CSV import enrichment phase that fetches titles for blank fields
- UI updates to show enrichment progress and results
- Documentation updates

**Performance Characteristics:**
- Sequential fetching (one URL at a time)
- 5-second timeout per URL
- Typical import with 10 blank titles: ~30-50 seconds
- Large import with 50 blank titles: ~3-4 minutes

**Error Handling:**
- Fetch failures leave title blank (no import failure)
- Enrichment stats track successful/failed fetches
- User sees clear feedback in import summary

**Future Enhancements (if needed):**
- Parallel fetching with rate limiting
- Real-time progress counters
- Configurable timeout
- Cache fetched titles
- Support for Open Graph tags as fallback

---

## Implementation Complete

**Date:** 2026-02-02
**Status:** ✅ All tasks completed and tested

### Implementation Summary
- Title fetcher service created with 5-second timeout
- CSV schema updated to allow blank titles
- Enrichment logic added to CSV router (sequential fetching)
- UI updated with enrichment status display
- Comprehensive test materials created
- Code review passed with production-ready rating

### Files Modified
- `src/server/services/title-fetcher.ts` (created)
- `src/server/api/routers/csv.ts` (enrichment logic added)
- `src/app/content/_components/import-csv-dialog.tsx` (UI updates)

### Test Materials
- 4 test CSV files in `test-csvs/` directory
- Comprehensive testing documentation

*Implementation validated: 2026-02-02*

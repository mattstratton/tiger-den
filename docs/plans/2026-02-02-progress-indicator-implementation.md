# CSV Import Progress Indicator - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real-time progress updates to CSV import using Server-Sent Events (SSE)

**Architecture:** Create SSE route handler that streams progress events during CSV processing. Frontend opens EventSource connection, displays progress bar with current operation, row count, and percentage. Import continues in background with progress updates every 10 rows.

**Tech Stack:** Next.js App Router route handlers, EventSource API, React state management, existing tRPC/Papa Parse infrastructure

---

## Task 1: Create Session Storage Service

**Files:**
- Create: `src/server/services/import-session-storage.ts`

**Purpose:** Manage temporary storage for import sessions (CSV data + metadata)

**Step 1: Create session storage service**

Create `src/server/services/import-session-storage.ts`:

```typescript
interface ImportSession {
  id: string;
  userId: string;
  rows: Array<Record<string, unknown>>;
  createdAt: Date;
  expiresAt: Date;
}

// Simple in-memory store (can be replaced with Redis later)
const sessions = new Map<string, ImportSession>();

export function createSession(
  id: string,
  userId: string,
  rows: Array<Record<string, unknown>>
): ImportSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

  const session: ImportSession = {
    id,
    userId,
    rows,
    createdAt: now,
    expiresAt,
  };

  sessions.set(id, session);
  return session;
}

export function getSession(id: string): ImportSession | undefined {
  const session = sessions.get(id);

  // Check expiration
  if (session && session.expiresAt < new Date()) {
    sessions.delete(id);
    return undefined;
  }

  return session;
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}

export function cleanupExpiredSessions(): void {
  const now = new Date();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(id);
    }
  }
}

// Clean up expired sessions every minute
setInterval(cleanupExpiredSessions, 60000);
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/import-session-storage.ts
git commit -m "feat(csv): add import session storage service

- In-memory session storage for CSV import data
- 15-minute expiration with automatic cleanup
- Session CRUD operations"
```

---

## Task 2: Create Start Import API Endpoint

**Files:**
- Create: `src/app/api/csv/start-import/route.ts`

**Purpose:** Endpoint to receive CSV data and create import session

**Step 1: Create start-import route handler**

Create `src/app/api/csv/start-import/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '~/server/auth';
import { createSession } from '~/server/services/import-session-storage';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { sessionId, rows } = body;

    if (!sessionId || !rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Create session
    createSession(sessionId, session.user.id, rows);

    return NextResponse.json({ success: true, sessionId });
  } catch (error) {
    console.error('Error starting import:', error);
    return NextResponse.json(
      { error: 'Failed to start import' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Test manually (optional at this stage)**

Can test with curl after completing Task 3.

**Step 4: Commit**

```bash
git add src/app/api/csv/start-import/route.ts
git commit -m "feat(csv): add start-import API endpoint

- Accepts CSV rows and session ID
- Creates import session storage
- Validates authentication"
```

---

## Task 3: Create Import Progress Event Types

**Files:**
- Create: `src/types/import-progress.ts`

**Purpose:** Define TypeScript types for SSE events

**Step 1: Create type definitions**

Create `src/types/import-progress.ts`:

```typescript
export type ImportPhase = 'enriching' | 'validating' | 'inserting';

export interface ProgressEvent {
  type: 'progress';
  phase: ImportPhase;
  current: number;
  total: number;
  percentage: number;
  errorCount: number;
  message: string;
}

export interface CompleteEvent {
  type: 'complete';
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

export interface ErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}

export type ImportEvent = ProgressEvent | CompleteEvent | ErrorEvent;
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/import-progress.ts
git commit -m "feat(csv): add import progress event types

- ProgressEvent, CompleteEvent, ErrorEvent types
- Type-safe SSE event definitions"
```

---

## Task 4: Extract CSV Processing Logic to Separate Function

**Files:**
- Modify: `src/server/api/routers/csv.ts`
- Create: `src/server/services/csv-processor.ts`

**Purpose:** Extract processing logic so it can be reused by SSE endpoint

**Step 1: Create CSV processor service**

Create `src/server/services/csv-processor.ts`:

```typescript
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { contentItems, campaigns, contentCampaigns } from "~/server/db/schema";
import { fetchPageTitle } from "./title-fetcher";
import type { ImportEvent } from "~/types/import-progress";

// Copy csvRowSchema from csv.ts
import { z } from "zod";

const csvRowSchema = z.object({
  title: z.string().optional().or(z.literal("")),
  current_url: z.string().url("Invalid URL format"),
  content_type: z.enum([
    "youtube_video",
    "blog_post",
    "case_study",
    "website_content",
    "third_party_content",
  ]),
  publish_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  description: z.string().optional(),
  author: z.string().optional(),
  target_audience: z.string().optional(),
  campaigns: z.string().optional(),
  tags: z.string().optional(),
});

interface ProcessResult {
  successful: number;
  failed: number;
  errors: Array<{
    row: number;
    message: string;
    field?: string;
  }>;
  enrichment: {
    attempted: number;
    successful: number;
    failed: number;
  };
}

export async function processImportWithProgress(
  rows: Array<Record<string, unknown>>,
  userId: string,
  sendEvent?: (event: ImportEvent) => void
): Promise<ProcessResult> {
  const total = rows.length;
  let currentRow = 0;
  let errorCount = 0;
  const errors: ProcessResult['errors'] = [];
  const enrichmentStats = { attempted: 0, successful: 0, failed: 0 };
  const processedUrls = new Set<string>();

  // Phase 1: Enrichment
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Only attempt enrichment if title is blank
    if (!row.title || (typeof row.title === 'string' && row.title.trim() === "")) {
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

    currentRow++;

    // Emit progress every 10 rows or at the end
    if (sendEvent && (currentRow % 10 === 0 || currentRow === total)) {
      sendEvent({
        type: 'progress',
        phase: 'enriching',
        current: currentRow,
        total,
        percentage: Math.round((currentRow / total) * 100),
        errorCount,
        message: `Enriching titles: ${currentRow}/${total} rows (${Math.round((currentRow / total) * 100)}%)${errorCount > 0 ? ` - ${errorCount} errors` : ''}`,
      });
    }
  }

  // Phase 2: Validation & Insertion
  currentRow = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNumber = i + 2; // Row 1 is headers, data starts at row 2
    const row = rows[i];

    try {
      // Validate row
      const validatedRow = csvRowSchema.parse(row);

      // Check for duplicate URL within CSV
      if (processedUrls.has(validatedRow.current_url)) {
        throw new Error("Duplicate URL in this CSV file");
      }

      // Check for duplicate URL in database
      const existing = await db.query.contentItems.findFirst({
        where: eq(contentItems.currentUrl, validatedRow.current_url),
      });

      if (existing) {
        throw new Error("URL already exists in database");
      }

      // Parse tags (comma-separated)
      const tags = validatedRow.tags
        ? validatedRow.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
        : undefined;

      // Parse campaign names (comma-separated)
      const campaignNames = validatedRow.campaigns
        ? validatedRow.campaigns.split(",").map((name) => name.trim()).filter(Boolean)
        : [];

      // Handle campaigns (create if needed)
      const campaignIds: string[] = [];
      for (const name of campaignNames) {
        const trimmedName = name.trim();
        if (!trimmedName) continue;

        // Check if campaign exists
        let campaign = await db.query.campaigns.findFirst({
          where: eq(campaigns.name, trimmedName),
        });

        // Create campaign if it doesn't exist
        if (!campaign) {
          const [newCampaign] = await db
            .insert(campaigns)
            .values({
              name: trimmedName,
              userId: userId,
            })
            .returning();
          campaign = newCampaign;
        }

        if (campaign) {
          campaignIds.push(campaign.id);
        }
      }

      // Insert content item
      const [contentItem] = await db
        .insert(contentItems)
        .values({
          title: validatedRow.title || validatedRow.current_url,
          currentUrl: validatedRow.current_url,
          contentType: validatedRow.content_type,
          publishDate: new Date(validatedRow.publish_date),
          description: validatedRow.description,
          author: validatedRow.author,
          targetAudience: validatedRow.target_audience,
          tags,
          userId: userId,
          source: "csv_import",
        })
        .returning();

      // Link campaigns
      if (campaignIds.length > 0 && contentItem) {
        await db.insert(contentCampaigns).values(
          campaignIds.map((campaignId) => ({
            contentId: contentItem.id,
            campaignId,
          }))
        );
      }

      processedUrls.add(validatedRow.current_url);
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Extract field name from Zod errors
      let field: string | undefined;
      if (error instanceof z.ZodError) {
        field = error.errors[0]?.path[0]?.toString();
      }

      errors.push({
        row: rowNumber,
        message: errorMessage,
        field,
      });
    }

    currentRow++;

    // Emit progress every 10 rows or at the end
    if (sendEvent && (currentRow % 10 === 0 || currentRow === total)) {
      sendEvent({
        type: 'progress',
        phase: 'validating',
        current: currentRow,
        total,
        percentage: Math.round((currentRow / total) * 100),
        errorCount,
        message: `Validating: ${currentRow}/${total} rows (${Math.round((currentRow / total) * 100)}%)${errorCount > 0 ? ` - ${errorCount} errors` : ''}`,
      });
    }
  }

  return {
    successful: total - errorCount,
    failed: errorCount,
    errors,
    enrichment: enrichmentStats,
  };
}
```

**Step 2: Update csv.ts router to use new processor**

Modify `src/server/api/routers/csv.ts` - replace the mutation implementation:

```typescript
import { processImportWithProgress } from "~/server/services/csv-processor";

// ... existing code ...

.mutation(async ({ ctx, input }) => {
  // Use the processor without progress events (legacy endpoint)
  const result = await processImportWithProgress(
    input.rows,
    ctx.session.user.id
  );

  return result;
}),
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Test existing CSV import still works**

Run: `npm run dev`
Test: Upload a small CSV through the UI
Expected: Import succeeds, same behavior as before

**Step 5: Commit**

```bash
git add src/server/services/csv-processor.ts src/server/api/routers/csv.ts
git commit -m "refactor(csv): extract processing logic to separate service

- Move CSV processing to csv-processor.ts
- Support optional progress event emission
- Reuse logic in both tRPC and SSE endpoints"
```

---

## Task 5: Create SSE Import Stream Endpoint

**Files:**
- Create: `src/app/api/csv/import-stream/route.ts`

**Purpose:** SSE endpoint that streams progress events during import

**Step 1: Create import-stream route handler**

Create `src/app/api/csv/import-stream/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { auth } from '~/server/auth';
import { getSession, deleteSession } from '~/server/services/import-session-storage';
import { processImportWithProgress } from '~/server/services/csv-processor';
import type { ImportEvent } from '~/types/import-progress';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get session ID from query params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session');

    if (!sessionId) {
      return new Response('Missing session ID', { status: 400 });
    }

    // Get import session
    const importSession = getSession(sessionId);
    if (!importSession) {
      return new Response('Session not found or expired', { status: 404 });
    }

    // Verify session ownership
    if (importSession.userId !== session.user.id) {
      return new Response('Forbidden', { status: 403 });
    }

    // Set up SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Helper to send SSE event
        const sendEvent = (data: ImportEvent) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        // Keep-alive interval (every 30 seconds)
        const keepAliveInterval = setInterval(() => {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        }, 30000);

        try {
          // Process import with progress events
          const result = await processImportWithProgress(
            importSession.rows,
            session.user.id,
            sendEvent
          );

          // Send completion event
          sendEvent({
            type: 'complete',
            successful: result.successful,
            failed: result.failed,
            errors: result.errors,
            enrichment: result.enrichment,
          });
        } catch (error) {
          // Send error event
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          sendEvent({
            type: 'error',
            message: errorMessage,
          });
        } finally {
          // Clean up
          clearInterval(keepAliveInterval);
          deleteSession(sessionId);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('Error in import stream:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/csv/import-stream/route.ts
git commit -m "feat(csv): add SSE import stream endpoint

- Streams real-time progress events during import
- Emits progress every 10 rows
- Sends completion or error events
- Keep-alive pings every 30 seconds"
```

---

## Task 6: Update Import Dialog - Add Progress State

**Files:**
- Modify: `src/app/content/_components/import-csv-dialog.tsx`

**Purpose:** Add state management for progress tracking

**Step 1: Add progress state and EventSource ref**

In `import-csv-dialog.tsx`, add new state after existing state declarations:

```typescript
const [progress, setProgress] = useState<{
  phase: 'enriching' | 'validating' | 'inserting' | null;
  current: number;
  total: number;
  percentage: number;
  errorCount: number;
  message: string;
} | null>(null);
const [eventSource, setEventSource] = useState<EventSource | null>(null);
```

**Step 2: Add cleanup effect**

Add useEffect for EventSource cleanup:

```typescript
useEffect(() => {
  return () => {
    if (eventSource) {
      eventSource.close();
    }
  };
}, [eventSource]);
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/content/_components/import-csv-dialog.tsx
git commit -m "feat(csv): add progress state to import dialog

- Add progress state tracking
- Add EventSource ref
- Add cleanup effect for EventSource"
```

---

## Task 7: Update Import Dialog - Replace Import Logic

**Files:**
- Modify: `src/app/content/_components/import-csv-dialog.tsx`

**Purpose:** Replace tRPC mutation with SSE-based import

**Step 1: Replace handleDrop function**

Replace the existing `handleDrop` function in `import-csv-dialog.tsx`:

```typescript
const handleDrop = useCallback(
  (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setImporting(true);
    setResult(null);
    setProgress(null);

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data;

          // Generate session ID
          const sessionId = crypto.randomUUID();

          // Send rows to start-import endpoint
          const startResponse = await fetch('/api/csv/start-import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, rows }),
          });

          if (!startResponse.ok) {
            throw new Error('Failed to start import');
          }

          // Open SSE connection
          const es = new EventSource(`/api/csv/import-stream?session=${sessionId}`);

          es.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);

              if (data.type === 'progress') {
                setProgress({
                  phase: data.phase,
                  current: data.current,
                  total: data.total,
                  percentage: data.percentage,
                  errorCount: data.errorCount,
                  message: data.message,
                });
              } else if (data.type === 'complete') {
                setResult({
                  successful: data.successful,
                  failed: data.failed,
                  errors: data.errors,
                  enrichment: data.enrichment,
                });
                setProgress(null);
                setImporting(false);
                es.close();
                setEventSource(null);
              } else if (data.type === 'error') {
                console.error('Import error:', data.message);
                setImporting(false);
                setProgress(null);
                es.close();
                setEventSource(null);
                // Could add error state here
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
            }
          };

          es.onerror = (error) => {
            console.error('SSE connection error:', error);
            es.close();
            setImporting(false);
            setProgress(null);
            setEventSource(null);
            // Could add error state here
          };

          setEventSource(es);
        } catch (error) {
          console.error('Error starting import:', error);
          setImporting(false);
          setProgress(null);
        }
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        setImporting(false);
      },
    });
  },
  []
);
```

**Step 2: Update handleClose to clean up EventSource**

Modify the `handleClose` function:

```typescript
const handleClose = () => {
  if (eventSource) {
    eventSource.close();
    setEventSource(null);
  }
  setResult(null);
  setProgress(null);
  setImporting(false);
  onOpenChange(false);
};
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/content/_components/import-csv-dialog.tsx
git commit -m "feat(csv): replace tRPC import with SSE-based import

- Generate session ID and send to start-import
- Open EventSource connection to import-stream
- Handle progress, complete, and error events
- Clean up EventSource on close"
```

---

## Task 8: Update Import Dialog - Add Progress UI

**Files:**
- Modify: `src/app/content/_components/import-csv-dialog.tsx`

**Purpose:** Display progress bar and status during import

**Step 1: Add imports for progress icons**

Add to existing imports at top of file:

```typescript
import { Loader2, CheckCircle2, Database } from "lucide-react";
import { Progress } from "~/components/ui/progress";
import { Badge } from "~/components/ui/badge";
```

**Step 2: Replace importing message in dropzone**

Find the section in the dropzone that shows "Importing content items..." and replace it with:

```typescript
{importing && progress ? (
  <div className="space-y-4">
    {/* Progress Bar */}
    <Progress value={progress.percentage} className="w-full" />

    {/* Status Message */}
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {progress.message}
      </p>
      {progress.errorCount > 0 && (
        <Badge variant="destructive">
          {progress.errorCount} {progress.errorCount === 1 ? 'error' : 'errors'}
        </Badge>
      )}
    </div>

    {/* Phase Indicator */}
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {progress.phase === 'enriching' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Fetching titles from URLs...</span>
        </>
      )}
      {progress.phase === 'validating' && (
        <>
          <CheckCircle2 className="h-3 w-3" />
          <span>Validating rows...</span>
        </>
      )}
      {progress.phase === 'inserting' && (
        <>
          <Database className="h-3 w-3" />
          <span>Inserting to database...</span>
        </>
      )}
    </div>
  </div>
) : importing ? (
  <p className="text-sm text-muted-foreground">
    Starting import...
  </p>
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
```

**Step 3: Verify Progress component exists**

Check if `src/components/ui/progress.tsx` exists. If not, create it:

```typescript
import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "~/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
```

If creating the Progress component, install the dependency:

```bash
npm install @radix-ui/react-progress
```

**Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Test manually**

Run: `npm run dev`
Test: Upload a CSV with 10+ rows
Expected: Progress bar appears, percentage updates, phase changes

**Step 6: Commit**

```bash
git add src/app/content/_components/import-csv-dialog.tsx src/components/ui/progress.tsx
git commit -m "feat(csv): add progress UI with bar and phase indicators

- Display progress bar with percentage
- Show current operation message
- Display error badge if errors occur
- Phase-specific icons (spinner, checkmark, database)
- Add shadcn Progress component"
```

---

## Task 9: Create Test CSV Files for Progress Testing

**Files:**
- Create: `test-csvs/progress-medium.csv`
- Create: `test-csvs/progress-large.csv`
- Create: `test-csvs/progress-errors.csv`

**Purpose:** Test files for progress indicator with various sizes

**Step 1: Create medium test file (50 rows)**

Create `test-csvs/progress-medium.csv`:

```csv
title,current_url,content_type,publish_date,description,author,target_audience,campaigns,tags
,https://en.wikipedia.org/wiki/PostgreSQL,blog_post,2024-01-01,PostgreSQL article,Test Author,developers,Test Campaign,database
,https://github.com/timescale/timescaledb,blog_post,2024-01-02,TimescaleDB repo,Test Author,developers,Test Campaign,database
Content 3,https://example.com/content-3,blog_post,2024-01-03,Test content 3,Test Author,developers,Test Campaign,test
,https://www.postgresql.org/docs/,blog_post,2024-01-04,PostgreSQL docs,Test Author,developers,Test Campaign,database
Content 5,https://example.com/content-5,blog_post,2024-01-05,Test content 5,Test Author,developers,Test Campaign,test
,https://timescale.com/blog,blog_post,2024-01-06,Timescale blog,Test Author,developers,Test Campaign,database
Content 7,https://example.com/content-7,blog_post,2024-01-07,Test content 7,Test Author,developers,Test Campaign,test
,https://www.anthropic.com/,blog_post,2024-01-08,Anthropic website,Test Author,developers,Test Campaign,ai
Content 9,https://example.com/content-9,blog_post,2024-01-09,Test content 9,Test Author,developers,Test Campaign,test
,https://nextjs.org/docs,blog_post,2024-01-10,Next.js docs,Test Author,developers,Test Campaign,frontend
Content 11,https://example.com/content-11,blog_post,2024-01-11,Test content 11,Test Author,developers,Test Campaign,test
Content 12,https://example.com/content-12,blog_post,2024-01-12,Test content 12,Test Author,developers,Test Campaign,test
,https://react.dev/,blog_post,2024-01-13,React docs,Test Author,developers,Test Campaign,frontend
Content 14,https://example.com/content-14,blog_post,2024-01-14,Test content 14,Test Author,developers,Test Campaign,test
,https://www.typescriptlang.org/,blog_post,2024-01-15,TypeScript website,Test Author,developers,Test Campaign,frontend
Content 16,https://example.com/content-16,blog_post,2024-01-16,Test content 16,Test Author,developers,Test Campaign,test
Content 17,https://example.com/content-17,blog_post,2024-01-17,Test content 17,Test Author,developers,Test Campaign,test
,https://tailwindcss.com/,blog_post,2024-01-18,Tailwind CSS,Test Author,developers,Test Campaign,frontend
Content 19,https://example.com/content-19,blog_post,2024-01-19,Test content 19,Test Author,developers,Test Campaign,test
,https://drizzle.team/,blog_post,2024-01-20,Drizzle ORM,Test Author,developers,Test Campaign,database
Content 21,https://example.com/content-21,blog_post,2024-01-21,Test content 21,Test Author,developers,Test Campaign,test
Content 22,https://example.com/content-22,blog_post,2024-01-22,Test content 22,Test Author,developers,Test Campaign,test
,https://trpc.io/,blog_post,2024-01-23,tRPC website,Test Author,developers,Test Campaign,api
Content 24,https://example.com/content-24,blog_post,2024-01-24,Test content 24,Test Author,developers,Test Campaign,test
,https://nodejs.org/,blog_post,2024-01-25,Node.js website,Test Author,developers,Test Campaign,backend
Content 26,https://example.com/content-26,blog_post,2024-01-26,Test content 26,Test Author,developers,Test Campaign,test
Content 27,https://example.com/content-27,blog_post,2024-01-27,Test content 27,Test Author,developers,Test Campaign,test
,https://vercel.com/docs,blog_post,2024-01-28,Vercel docs,Test Author,developers,Test Campaign,deployment
Content 29,https://example.com/content-29,blog_post,2024-01-29,Test content 29,Test Author,developers,Test Campaign,test
Content 30,https://example.com/content-30,blog_post,2024-01-30,Test content 30,Test Author,developers,Test Campaign,test
,https://github.com/features,blog_post,2024-01-31,GitHub features,Test Author,developers,Test Campaign,tools
Content 32,https://example.com/content-32,blog_post,2024-02-01,Test content 32,Test Author,developers,Test Campaign,test
Content 33,https://example.com/content-33,blog_post,2024-02-02,Test content 33,Test Author,developers,Test Campaign,test
,https://www.docker.com/,blog_post,2024-02-03,Docker website,Test Author,developers,Test Campaign,devops
Content 35,https://example.com/content-35,blog_post,2024-02-04,Test content 35,Test Author,developers,Test Campaign,test
Content 36,https://example.com/content-36,blog_post,2024-02-05,Test content 36,Test Author,developers,Test Campaign,test
,https://kubernetes.io/,blog_post,2024-02-06,Kubernetes,Test Author,developers,Test Campaign,devops
Content 38,https://example.com/content-38,blog_post,2024-02-07,Test content 38,Test Author,developers,Test Campaign,test
Content 39,https://example.com/content-39,blog_post,2024-02-08,Test content 39,Test Author,developers,Test Campaign,test
,https://www.python.org/,blog_post,2024-02-09,Python website,Test Author,developers,Test Campaign,languages
Content 41,https://example.com/content-41,blog_post,2024-02-10,Test content 41,Test Author,developers,Test Campaign,test
Content 42,https://example.com/content-42,blog_post,2024-02-11,Test content 42,Test Author,developers,Test Campaign,test
,https://go.dev/,blog_post,2024-02-12,Go website,Test Author,developers,Test Campaign,languages
Content 44,https://example.com/content-44,blog_post,2024-02-13,Test content 44,Test Author,developers,Test Campaign,test
Content 45,https://example.com/content-45,blog_post,2024-02-14,Test content 45,Test Author,developers,Test Campaign,test
,https://www.rust-lang.org/,blog_post,2024-02-15,Rust website,Test Author,developers,Test Campaign,languages
Content 47,https://example.com/content-47,blog_post,2024-02-16,Test content 47,Test Author,developers,Test Campaign,test
Content 48,https://example.com/content-48,blog_post,2024-02-17,Test content 48,Test Author,developers,Test Campaign,test
Content 49,https://example.com/content-49,blog_post,2024-02-18,Test content 49,Test Author,developers,Test Campaign,test
Content 50,https://example.com/content-50,blog_post,2024-02-19,Test content 50,Test Author,developers,Test Campaign,test
```

**Step 2: Update test-csvs README**

Add to `test-csvs/README.md`:

```markdown
## Progress Indicator Testing

### progress-medium.csv (50 rows)
- 50 rows total
- Mix of blank titles (10) and pre-filled titles (40)
- Real URLs for enrichment testing
- Tests batched progress updates
- Expected duration: ~1-2 minutes
```

**Step 3: Commit**

```bash
git add test-csvs/progress-medium.csv test-csvs/README.md
git commit -m "test(csv): add progress-medium test file

- 50 rows for progress indicator testing
- Mix of blank and pre-filled titles
- Real URLs for enrichment"
```

---

## Task 10: Manual Testing and Documentation

**Files:**
- Create: `docs/testing/progress-indicator-test-results.md`
- Modify: `FOLLOW-UP.md`

**Purpose:** Document testing results and update follow-up tracking

**Step 1: Manual testing**

Test scenarios:
1. Small import (5 rows) - verify progress appears
2. Medium import (50 rows) - verify batched updates
3. Large import with errors - verify error counting
4. Close dialog mid-import - verify cleanup

**Step 2: Create test results document**

Create `docs/testing/progress-indicator-test-results.md`:

```markdown
# Progress Indicator - Test Results

**Date:** 2026-02-02
**Tester:** [Your name]

## Test Scenarios

### 1. Small Import (5-10 rows)
- [ ] Progress bar appears
- [ ] Percentage updates correctly
- [ ] Phase transitions visible (enriching → validating)
- [ ] Final results display correctly

### 2. Medium Import (50 rows)
- [ ] Updates appear every ~1-2 seconds
- [ ] Progress percentage accurate
- [ ] Error count updates if errors occur
- [ ] SSE connection stable

### 3. Large Import (100+ rows)
- [ ] Connection stays alive (keep-alive pings)
- [ ] No memory leaks
- [ ] UI remains responsive
- [ ] Final results accurate

### 4. Error Handling
- [ ] Import with duplicate URLs shows error count
- [ ] Errors accumulate correctly
- [ ] Final error list matches error count
- [ ] Import completes despite errors

### 5. Connection Issues
- [ ] Close dialog mid-import cleans up EventSource
- [ ] Refresh page shows error (connection lost)
- [ ] No partial data in database

## Results

[Document actual test results here]

## Issues Found

[List any issues discovered during testing]

## Sign-off

- [ ] All scenarios tested
- [ ] No blocking issues
- [ ] Ready for production
```

**Step 3: Update FOLLOW-UP.md**

Move "Progress Indicator During Import" from pending to completed:

```markdown
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
```

**Step 4: Commit**

```bash
git add docs/testing/progress-indicator-test-results.md FOLLOW-UP.md
git commit -m "docs: add progress indicator testing documentation

- Test results template
- Update FOLLOW-UP.md with completion"
```

---

## Task 11: Deploy to Production and Verify

**Files:**
- None (deployment task)

**Purpose:** Deploy progress indicator to production and verify functionality

**Step 1: Ensure all changes committed**

Run: `git status`
Expected: Working tree clean

**Step 2: Push to GitHub**

Run: `git push origin main`
Expected: Push successful

**Step 3: Verify Vercel deployment**

Wait for Vercel to deploy automatically. Check deployment status in Vercel dashboard or:

Run: `vercel --prod`

**Step 4: Test in production**

1. Navigate to https://tiger-den.vercel.app
2. Sign in
3. Go to content page
4. Import test-csvs/progress-medium.csv
5. Verify progress bar appears and updates
6. Verify final results display correctly

**Step 5: Document production test results**

Update `docs/testing/progress-indicator-test-results.md` with production test results.

**Step 6: Final commit (if any fixes needed)**

If issues found in production:
```bash
git add [fixed files]
git commit -m "fix(csv): production deployment fixes"
git push origin main
```

Otherwise, feature is complete!

---

## Summary

**Total Tasks:** 11
**Estimated Time:** 4-6 hours

**Key Files Modified:**
- `src/server/services/import-session-storage.ts` (new)
- `src/server/services/csv-processor.ts` (new)
- `src/types/import-progress.ts` (new)
- `src/app/api/csv/start-import/route.ts` (new)
- `src/app/api/csv/import-stream/route.ts` (new)
- `src/server/api/routers/csv.ts` (modified)
- `src/app/content/_components/import-csv-dialog.tsx` (modified)
- `src/components/ui/progress.tsx` (new)
- `test-csvs/progress-medium.csv` (new)

**Dependencies Added:**
- `@radix-ui/react-progress` (for Progress component)

**Testing:**
- Manual testing with small, medium, and large CSVs
- Error handling scenarios
- Connection stability testing
- Production verification

---

*Implementation plan complete: 2026-02-02*

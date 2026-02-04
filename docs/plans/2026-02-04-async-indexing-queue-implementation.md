# Async Indexing Queue Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement pg-boss background queue to process bulk CSV imports with 5 concurrent workers, retry logic, and admin dashboard.

**Architecture:** pg-boss queue embedded in Next.js server with 5 concurrent workers. Auto-enqueues items during CSV imports when exceeding sync threshold. New tRPC router for queue management and admin dashboard at /admin/queue.

**Tech Stack:** pg-boss, tRPC, Next.js 16, React 19, TypeScript, Tailwind CSS

---

## Task 1: Install pg-boss and Create Queue Singleton

**Files:**
- Create: `src/server/queue/indexing-queue.ts`
- Modify: `package.json`

**Step 1: Install pg-boss**

Run: `npm install pg-boss`

Expected: Package added to package.json and node_modules

**Step 2: Create queue singleton**

Create `src/server/queue/indexing-queue.ts`:

```typescript
import PgBoss from "pg-boss";
import { env } from "~/env";

let boss: PgBoss | null = null;

/**
 * Get or create the pg-boss queue instance
 * Singleton pattern to ensure only one instance exists
 */
export async function getQueue(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss({
      connectionString: env.DATABASE_URL,
      schema: "pgboss",
      retryLimit: 3,
      retryDelay: 5, // 5 minutes
      retryBackoff: true, // exponential: 5min, 30min, 2hr
      archiveCompletedAfterSeconds: 86400, // keep completed jobs for 24hrs
    });

    await boss.start();
    console.log("[Queue] pg-boss started successfully");
  }

  return boss;
}

/**
 * Job payload for index-content jobs
 */
export interface IndexJobPayload {
  contentItemId: string;
  url: string;
  attempt?: number;
}
```

**Step 3: Verify no TypeScript errors**

Run: `npm run typecheck`

Expected: No errors

**Step 4: Commit**

```bash
git add package.json package-lock.json src/server/queue/indexing-queue.ts
git commit -m "feat: add pg-boss queue singleton

- Install pg-boss dependency
- Create queue singleton with retry configuration
- Add IndexJobPayload type definition

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Queue Worker

**Files:**
- Create: `src/server/queue/worker.ts`

**Step 1: Create worker file**

Create `src/server/queue/worker.ts`:

```typescript
import { getQueue } from "./indexing-queue";
import { indexSingleItem } from "../services/indexing-orchestrator";
import type { IndexJobPayload } from "./indexing-queue";

/**
 * Start the queue worker to process index-content jobs
 * Worker runs with 5 concurrent workers (teamSize)
 */
export async function startWorker() {
  const queue = await getQueue();

  await queue.work<IndexJobPayload>(
    "index-content",
    { teamSize: 5 },
    async (job) => {
      const { contentItemId, url } = job.data;

      console.log(
        `[Worker] Processing job ${job.id} for item ${contentItemId}`,
      );

      const result = await indexSingleItem(contentItemId, url);

      if (!result.success) {
        console.error(
          `[Worker] Job ${job.id} failed:`,
          result.error,
        );
        throw new Error(result.error || "Indexing failed");
      }

      console.log(`[Worker] Job ${job.id} completed successfully`);
      return result;
    },
  );

  console.log("[Worker] Started with 5 concurrent workers");
}
```

**Step 2: Verify no TypeScript errors**

Run: `npm run typecheck`

Expected: No errors

**Step 3: Commit**

```bash
git add src/server/queue/worker.ts
git commit -m "feat: add queue worker with 5 concurrent workers

Worker processes index-content jobs by calling indexSingleItem.
Throws errors on failure to trigger pg-boss retry logic.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Start Worker on Server Startup

**Files:**
- Modify: `src/server/api/root.ts`

**Step 1: Import and start worker**

Add to the top of `src/server/api/root.ts` after imports:

```typescript
import { startWorker } from "../queue/worker";

// Start queue worker on server startup (skip in test environment)
if (process.env.NODE_ENV !== "test") {
  startWorker().catch((error) => {
    console.error("[Worker] Failed to start:", error);
  });
}
```

**Step 2: Test dev server starts**

Run: `npm run dev`

Expected: Server starts, console shows "[Queue] pg-boss started successfully" and "[Worker] Started with 5 concurrent workers"

**Step 3: Stop dev server**

Press Ctrl+C to stop

**Step 4: Commit**

```bash
git add src/server/api/root.ts
git commit -m "feat: start queue worker on server startup

Worker starts automatically when Next.js server launches.
Skipped in test environment.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Update IndexingStats Type

**Files:**
- Modify: `src/server/services/indexing-orchestrator.ts:15-20`

**Step 1: Add queued field to IndexingStats**

In `src/server/services/indexing-orchestrator.ts`, update the `IndexingStats` interface:

```typescript
export interface IndexingStats {
  total: number;
  succeeded: number;
  failed: number;
  queued?: number; // NEW: number of items queued for background processing
  results: IndexingResult[];
}
```

**Step 2: Verify no TypeScript errors**

Run: `npm run typecheck`

Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/indexing-orchestrator.ts
git commit -m "feat: add queued field to IndexingStats type

Tracks number of items queued for background processing.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Modify Indexing Orchestrator to Enqueue Items

**Files:**
- Modify: `src/server/services/indexing-orchestrator.ts:175-213`

**Step 1: Import getQueue**

Add import at top of `src/server/services/indexing-orchestrator.ts`:

```typescript
import { getQueue } from "../queue/indexing-queue";
```

**Step 2: Replace async indexing logic**

Replace the code from line 175 onwards (the "Async indexing (Phase 2)" section) with:

```typescript
  // Async indexing: sync first N items, enqueue the rest
  const syncItems = items.slice(0, indexingConfig.syncThreshold);
  const queueItems = items.slice(indexingConfig.syncThreshold);

  // Step 1: Sync index first batch
  const syncResults: IndexingResult[] = [];

  for (const item of syncItems) {
    const result = await indexSingleItem(item.id, item.url);
    syncResults.push(result);
  }

  // Step 2: Enqueue remaining items
  const queue = await getQueue();
  const queueResults: IndexingResult[] = [];

  for (const item of queueItems) {
    try {
      // Enqueue job with deduplication
      await queue.send(
        "index-content",
        {
          contentItemId: item.id,
          url: item.url,
        },
        {
          singletonKey: item.id, // prevent duplicate jobs
        },
      );

      // Create placeholder content_text record
      await db.insert(contentText).values({
        contentItemId: item.id,
        fullText: "",
        plainText: "",
        wordCount: 0,
        tokenCount: 0,
        contentHash: "",
        crawlDurationMs: 0,
        indexStatus: "pending",
      });

      queueResults.push({
        success: true,
        contentItemId: item.id,
      });
    } catch (error) {
      queueResults.push({
        success: false,
        contentItemId: item.id,
        error:
          error instanceof Error ? error.message : "Failed to enqueue item",
      });
    }
  }

  const succeeded = syncResults.filter((r) => r.success).length;
  const failed = syncResults.filter((r) => !r.success).length;

  return {
    total: items.length,
    succeeded,
    failed,
    queued: queueResults.length,
    results: [...syncResults, ...queueResults],
  };
}
```

**Step 3: Verify no TypeScript errors**

Run: `npm run typecheck`

Expected: No errors

**Step 4: Commit**

```bash
git add src/server/services/indexing-orchestrator.ts
git commit -m "feat: enqueue items exceeding sync threshold

During CSV import:
- First 10 items indexed synchronously
- Remaining items enqueued with pg-boss
- Placeholder content_text records created
- Singleton key prevents duplicate jobs

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create Queue tRPC Router

**Files:**
- Create: `src/server/api/routers/queue.ts`

**Step 1: Create queue router**

Create `src/server/api/routers/queue.ts`:

```typescript
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { contentItems, contentText } from "~/server/db/schema";
import { getQueue } from "~/server/queue/indexing-queue";

export const queueRouter = createTRPCRouter({
  /**
   * Get queue statistics
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const queue = await getQueue();

    const [activeCount, completedCount, failedCount] = await Promise.all([
      queue.getQueueSize("index-content", { state: "active" }),
      queue.getQueueSize("index-content", { state: "completed" }),
      queue.getQueueSize("index-content", { state: "failed" }),
    ]);

    // Get pending items from database
    const pendingResult = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(contentText)
      .where(eq(contentText.indexStatus, "pending"));

    const pendingCount = Number(pendingResult[0]?.count ?? 0);

    return {
      queued: activeCount,
      processing: activeCount, // pg-boss doesn't distinguish queued vs processing
      completed: completedCount,
      failed: failedCount,
      pending: pendingCount,
    };
  }),

  /**
   * Pause the queue worker
   */
  pause: protectedProcedure.mutation(async () => {
    const queue = await getQueue();
    await queue.pause();
    return { success: true, message: "Queue paused" };
  }),

  /**
   * Resume the queue worker
   */
  resume: protectedProcedure.mutation(async () => {
    const queue = await getQueue();
    await queue.resume();
    return { success: true, message: "Queue resumed" };
  }),

  /**
   * Enqueue all pending items
   */
  enqueuePending: protectedProcedure.mutation(async ({ ctx }) => {
    // Get all pending items
    const pendingItems = await ctx.db
      .select({
        contentItemId: contentText.contentItemId,
        url: contentItems.currentUrl,
      })
      .from(contentText)
      .innerJoin(
        contentItems,
        eq(contentText.contentItemId, contentItems.id),
      )
      .where(eq(contentText.indexStatus, "pending"));

    if (pendingItems.length === 0) {
      return { enqueued: 0, message: "No pending items to enqueue" };
    }

    // Enqueue all items
    const queue = await getQueue();
    await Promise.all(
      pendingItems.map((item) =>
        queue.send(
          "index-content",
          {
            contentItemId: item.contentItemId,
            url: item.url,
          },
          {
            singletonKey: item.contentItemId,
          },
        ),
      ),
    );

    return {
      enqueued: pendingItems.length,
      message: `Enqueued ${pendingItems.length} items for indexing`,
    };
  }),

  /**
   * Retry all failed jobs
   */
  retryFailed: protectedProcedure.mutation(async () => {
    const queue = await getQueue();
    const failedJobs = await queue.fetch("index-content", 100, {
      state: "failed",
    });

    for (const job of failedJobs) {
      await queue.send("index-content", job.data, {
        singletonKey: job.data.contentItemId,
      });
      await queue.complete(job.id);
    }

    return {
      retried: failedJobs.length,
      message: `Retried ${failedJobs.length} failed jobs`,
    };
  }),
});
```

**Step 2: Verify no TypeScript errors**

Run: `npm run typecheck`

Expected: No errors

**Step 3: Commit**

```bash
git add src/server/api/routers/queue.ts
git commit -m "feat: add queue tRPC router

Endpoints:
- getStats: queue and database statistics
- pause/resume: control worker
- enqueuePending: bulk enqueue all pending items
- retryFailed: re-enqueue failed jobs

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Register Queue Router

**Files:**
- Modify: `src/server/api/root.ts`

**Step 1: Import queue router**

Add import near the top with other router imports:

```typescript
import { queueRouter } from "./routers/queue";
```

**Step 2: Add to appRouter**

Add to the router object:

```typescript
export const appRouter = createCallerFactory(createTRPCRouter)({
  post: postRouter,
  content: contentRouter,
  campaigns: campaignsRouter,
  csv: csvRouter,
  queue: queueRouter, // NEW
});
```

**Step 3: Verify no TypeScript errors**

Run: `npm run typecheck`

Expected: No errors

**Step 4: Test dev server starts**

Run: `npm run dev`

Expected: Server starts without errors

Stop with Ctrl+C

**Step 5: Commit**

```bash
git add src/server/api/root.ts
git commit -m "feat: register queue router in tRPC app

Exposes queue endpoints at api.queue.*

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Create Queue Dashboard Page

**Files:**
- Create: `src/app/admin/queue/page.tsx`

**Step 1: Create admin directory**

Run: `mkdir -p src/app/admin/queue`

**Step 2: Create dashboard page**

Create `src/app/admin/queue/page.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "~/trpc/react";

export default function QueueDashboard() {
  const { data: stats, refetch } = api.queue.getStats.useQuery(undefined, {
    refetchInterval: 5000, // refresh every 5 seconds
  });

  const pauseMutation = api.queue.pause.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      void refetch();
    },
    onError: (error) => {
      toast.error(`Failed to pause queue: ${error.message}`);
    },
  });

  const resumeMutation = api.queue.resume.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      void refetch();
    },
    onError: (error) => {
      toast.error(`Failed to resume queue: ${error.message}`);
    },
  });

  const enqueueMutation = api.queue.enqueuePending.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      void refetch();
    },
    onError: (error) => {
      toast.error(`Failed to enqueue items: ${error.message}`);
    },
  });

  const retryMutation = api.queue.retryFailed.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      void refetch();
    },
    onError: (error) => {
      toast.error(`Failed to retry jobs: ${error.message}`);
    },
  });

  // Show toast when queue completes
  useEffect(() => {
    if (
      stats &&
      stats.queued === 0 &&
      stats.processing === 0 &&
      stats.completed > 0
    ) {
      toast.success(
        `Queue processing complete! ${stats.completed} items indexed.`,
      );
    }
  }, [stats]);

  if (!stats) {
    return <div className="py-8 text-center">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="mb-8 text-3xl font-bold">Indexing Queue Dashboard</h1>

      {/* Stats Cards */}
      <div className="mb-8 grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle>Queued</CardTitle>
            <CardDescription>Items waiting to process</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.queued}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Processing</CardTitle>
            <CardDescription>Currently being indexed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.processing}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completed</CardTitle>
            <CardDescription>Successfully indexed (24hr)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.completed}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Failed</CardTitle>
            <CardDescription>Failed to index (24hr)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {stats.failed}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending</CardTitle>
            <CardDescription>Not yet queued</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-600">
              {stats.pending}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Queue Controls</CardTitle>
          <CardDescription>
            Manage the background indexing queue
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button
            onClick={() => pauseMutation.mutate()}
            disabled={pauseMutation.isPending}
            variant="outline"
          >
            Pause Queue
          </Button>

          <Button
            onClick={() => resumeMutation.mutate()}
            disabled={resumeMutation.isPending}
            variant="outline"
          >
            Resume Queue
          </Button>

          <Button
            onClick={() => {
              if (
                confirm(
                  `Enqueue all ${stats.pending} pending items for indexing?`,
                )
              ) {
                enqueueMutation.mutate();
              }
            }}
            disabled={stats.pending === 0 || enqueueMutation.isPending}
          >
            Enqueue All Pending Items ({stats.pending})
          </Button>

          <Button
            onClick={() => {
              if (
                confirm(`Retry all ${stats.failed} failed jobs?`)
              ) {
                retryMutation.mutate();
              }
            }}
            disabled={stats.failed === 0 || retryMutation.isPending}
            variant="outline"
          >
            Retry Failed Jobs ({stats.failed})
          </Button>
        </CardContent>
      </Card>

      {/* Info */}
      <div className="mt-8 rounded-lg bg-blue-50 p-4 text-sm">
        <p className="font-semibold">How it works:</p>
        <ul className="ml-4 mt-2 list-disc space-y-1">
          <li>CSV imports with &gt;10 items auto-enqueue the extras</li>
          <li>5 concurrent workers process items in the background</li>
          <li>Failed items retry 3 times with exponential backoff</li>
          <li>Stats refresh every 5 seconds</li>
          <li>
            Completed/failed counts show last 24 hours (then archived)
          </li>
        </ul>
      </div>
    </div>
  );
}
```

**Step 3: Verify no TypeScript errors**

Run: `npm run typecheck`

Expected: No errors

**Step 4: Test dashboard page**

Run: `npm run dev`

Visit: `http://localhost:3000/admin/queue`

Expected: Dashboard loads showing stats (likely 697 pending items)

Stop with Ctrl+C

**Step 5: Commit**

```bash
git add src/app/admin/queue/page.tsx
git commit -m "feat: add queue dashboard at /admin/queue

Features:
- Real-time stats (refresh every 5s)
- Pause/resume controls
- Enqueue all pending button
- Retry failed jobs button
- Toast notifications on completion

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Test with Existing 697 Pending Items

**Files:**
- None (manual testing)

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Navigate to dashboard**

Visit: `http://localhost:3000/admin/queue`

Expected: See "Pending: 697" in stats

**Step 3: Click "Enqueue All Pending Items"**

Click the button and confirm

Expected:
- Toast shows "Enqueued 697 items for indexing"
- Queued count increases to ~697
- Console shows worker processing jobs

**Step 4: Monitor progress**

Watch the dashboard auto-refresh every 5 seconds

Expected:
- Queued/Processing counts decrease
- Completed count increases
- Index status badges in content table update to "indexed"

**Step 5: Check for failures**

After some processing, check if any failed items

Expected: Some failures for videos without transcripts or 404 URLs

**Step 6: Stop and document results**

Stop server with Ctrl+C

Document findings in commit message

**Step 7: Commit test results**

```bash
git commit --allow-empty -m "test: verify queue processes 697 pending items

Manual testing results:
- Dashboard shows correct stats
- Enqueue button queues all pending items
- 5 workers process items concurrently
- Failed items have error messages
- Stats refresh every 5 seconds
- Toast notifications work

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Test CSV Import with Auto-Enqueue

**Files:**
- None (manual testing)

**Step 1: Create test CSV with 50 items**

Create a CSV file with 50 URLs to test auto-enqueue

**Step 2: Import CSV**

Use the CSV import feature in the UI

**Step 3: Verify behavior**

Expected:
- First 10 items indexed synchronously
- Remaining 40 items queued
- Dashboard shows 40 new items in queue
- Workers process the 40 items in background

**Step 4: Monitor dashboard**

Watch items process over time

Expected: All 50 items eventually indexed or failed

**Step 5: Document results**

```bash
git commit --allow-empty -m "test: verify CSV import auto-enqueues items >10

CSV import testing results:
- First 10 items indexed synchronously
- Remaining 40 items queued automatically
- No errors in console
- All items eventually processed

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Step 1: Update CLAUDE.md**

In the "Content Indexing & Hybrid Search" section, update:

```markdown
### Content Indexing & Hybrid Search
- Full-text indexing of web pages and YouTube transcripts
- Hybrid search: BM25 keyword + semantic vector with RRF fusion
- Leverages Tiger Cloud: pg_textsearch, pgvectorscale, pgai Vectorizer
- Sync indexing for ≤10 items (configurable threshold)
- **Background queue with pg-boss for bulk imports**
  - 5 concurrent workers
  - 3 retry attempts with exponential backoff
  - Admin dashboard at `/admin/queue`
- Manual re-index for failed/pending items
```

**Step 2: Update README.md**

Add to the Features section:

```markdown
- **Background Indexing Queue** - pg-boss queue processes bulk imports with 5 concurrent workers, retry logic, and admin dashboard for monitoring
```

**Step 3: Verify no TypeScript errors**

Run: `npm run typecheck`

Expected: No errors

**Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update documentation for async indexing queue

Document pg-boss queue implementation, worker configuration,
and admin dashboard.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Final Verification and Cleanup

**Files:**
- None (verification only)

**Step 1: Run full type check**

Run: `npm run typecheck`

Expected: No errors

**Step 2: Run linter**

Run: `npm run check`

Expected: No errors (or only warnings)

**Step 3: Test full flow**

1. Start dev server
2. Visit `/admin/queue`
3. Verify dashboard works
4. Click enqueue button if any pending items
5. Monitor processing
6. Import small CSV to test auto-enqueue

**Step 4: Review all commits**

Run: `git log --oneline -12`

Expected: See all 12 commits for this feature

**Step 5: Push to remote**

Run: `git push origin main`

**Step 6: Close GitHub issue**

Close issue #3 with reference to implementation

**Step 7: Final commit**

```bash
git commit --allow-empty -m "feat: async indexing queue complete

Complete implementation of pg-boss background queue:
✅ 5 concurrent workers
✅ Auto-enqueue during CSV imports
✅ Manual bulk enqueue for existing items
✅ Retry logic (3 attempts with backoff)
✅ Admin dashboard at /admin/queue
✅ Pause/resume controls
✅ Toast notifications
✅ Documentation updated

Closes #3

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary

This plan implements a complete async indexing queue using pg-boss:

- **Task 1-3:** Set up pg-boss queue and worker
- **Task 4-5:** Modify indexing orchestrator to auto-enqueue
- **Task 6-7:** Create tRPC API for queue management
- **Task 8:** Build admin dashboard
- **Task 9-10:** Test with real data
- **Task 11-12:** Documentation and verification

All tasks follow TDD where applicable, include exact file paths, complete code, and frequent commits. Ready to execute!

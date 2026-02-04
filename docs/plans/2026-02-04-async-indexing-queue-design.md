# Async Indexing Queue Design

**Date:** 2026-02-04
**Status:** Approved
**Implementation:** Pending

## Overview

Implement asynchronous background indexing queue to handle bulk CSV imports without blocking the UI. Currently, imports exceeding 10 items create placeholder records marked as "pending" but don't actually index the content. This design adds a pg-boss queue that processes pending items in the background with retry logic and monitoring.

## Problem Statement

**Current behavior:**
- CSV imports ≤10 items: indexed synchronously
- CSV imports >10 items: first 10 indexed sync, rest marked "pending" with empty content
- No automatic processing of pending items
- 697 pending items currently in database requiring manual re-indexing

**Desired behavior:**
- Automatic background processing of items exceeding sync threshold
- Reliable indexing with retry logic for transient failures
- Real-time visibility into queue status and progress
- Manual bulk enqueue for existing pending items

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Queue Technology | pg-boss | Uses existing PostgreSQL, no additional infrastructure |
| Worker Location | Embedded in Next.js | Simpler deployment, adequate for scale (~1000 item imports) |
| Concurrency | 5 workers | Balances speed (~2-3hrs for 697 items) with resource usage |
| Retry Strategy | 3 attempts, exponential backoff (5min, 30min, 2hr) | Handles transient failures without being wasteful |
| Triggering | Auto + Manual | Auto-enqueue during imports, manual button for backlog |
| Visibility | Dashboard + notifications | Dedicated monitoring page with completion alerts |

**Future consideration:** Add env var to disable embedded worker for horizontal scaling if needed.

## Architecture

### Components

1. **pg-boss Queue**
   - PostgreSQL-based job queue
   - Creates `pgboss` schema with job tables
   - Handles retry logic, backoff, and job archival

2. **Queue Worker**
   - Embedded in Next.js server process
   - Starts automatically on app launch
   - 5 concurrent workers processing jobs
   - Calls existing `indexSingleItem()` function

3. **Indexing Orchestrator** (modified)
   - Auto-enqueues items >threshold during CSV imports
   - First 10 items still indexed synchronously
   - Remaining items queued for background processing

4. **Queue Dashboard** (`/admin/queue`)
   - Real-time stats: queued, processing, completed, failed, pending
   - Pause/resume controls
   - Manual bulk enqueue button
   - Retry failed jobs button

5. **tRPC API**
   - `queue.getStats` - Queue statistics
   - `queue.pause` - Pause worker
   - `queue.resume` - Resume worker
   - `queue.enqueuePending` - Bulk enqueue all pending items
   - `queue.retryFailed` - Re-enqueue failed jobs

### Data Flow

```
CSV Import (>10 items)
  ↓
First 10 items → Sync indexing
  ↓
Remaining items → pg-boss.send('index-content', { contentItemId, url })
  ↓
Create placeholder content_text (pending status)
  ↓
Worker polls queue
  ↓
Fetch job → indexSingleItem(id, url)
  ↓
Success: content_text updated (indexed status, chunks created)
Failure: content_text updated (failed status, error message)
  ↓
Job completes or retries (3 attempts max)
```

## Implementation Details

### Queue Configuration

```typescript
// src/server/queue/indexing-queue.ts
const boss = new PgBoss({
  connectionString: env.DATABASE_URL,
  schema: 'pgboss',
  retryLimit: 3,
  retryDelay: 5,           // 5 minutes
  retryBackoff: true,      // exponential backoff
  archiveCompletedAfterSeconds: 86400,  // 24 hours
});
```

### Job Schema

**Job name:** `'index-content'`

**Payload:**
```typescript
interface IndexJobPayload {
  contentItemId: string;
  url: string;
  attempt?: number;
}
```

**Options:**
- `singletonKey: contentItemId` - prevents duplicate jobs

### Worker Setup

```typescript
// src/server/queue/worker.ts
export async function startWorker() {
  const queue = await getQueue();

  await queue.work('index-content',
    { teamSize: 5 },
    async (job) => {
      const { contentItemId, url } = job.data;
      const result = await indexSingleItem(contentItemId, url);

      if (!result.success) {
        throw new Error(result.error || 'Indexing failed');
      }

      return result;
    }
  );
}
```

**Startup:** Hook into Next.js initialization (skip in test environment)

### CSV Import Integration

**Modified logic in `indexing-orchestrator.ts`:**

```typescript
if (items.length > indexingConfig.syncThreshold) {
  const syncItems = items.slice(0, indexingConfig.syncThreshold);
  const queueItems = items.slice(indexingConfig.syncThreshold);

  // Sync index first batch
  const syncResults = await Promise.all(
    syncItems.map(item => indexSingleItem(item.id, item.url))
  );

  // Enqueue remaining items
  const queue = await getQueue();
  for (const item of queueItems) {
    await queue.send('index-content',
      { contentItemId: item.id, url: item.url },
      { singletonKey: item.id }
    );

    // Create placeholder content_text
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
  }

  return {
    total: items.length,
    succeeded: syncResults.filter(r => r.success).length,
    failed: syncResults.filter(r => !r.success).length,
    queued: queueItems.length,
    results: [...syncResults, ...queueResults],
  };
}
```

### Dashboard UI

**Route:** `/admin/queue`

**Features:**
- Stats cards showing counts (queued, processing, completed, failed, pending)
- Auto-refresh every 5 seconds
- Pause/Resume buttons
- "Enqueue All Pending Items" button with confirmation
- "Retry Failed Jobs" button
- Toast notifications on completion

**tRPC Integration:**
```typescript
const stats = api.queue.getStats.useQuery(undefined, {
  refetchInterval: 5000,
});

const enqueueMutation = api.queue.enqueuePending.useMutation({
  onSuccess: (data) => toast.success(data.message),
});
```

## Error Handling

### Retry Logic

1. Job fails → pg-boss schedules retry
2. Wait 5 minutes → retry #1
3. Wait 30 minutes → retry #2
4. Wait 2 hours → retry #3
5. After 3 failures → job moves to failed state

### Permanent Failures

Failures like 404s or missing transcripts are caught by `indexSingleItem()`:
- Updates `content_text.indexStatus = 'failed'`
- Sets `content_text.indexError = 'error message'`
- Job completes (no further retries)

### Duplicate Prevention

Use `singletonKey` option to prevent enqueueing same item twice:
```typescript
await queue.send('index-content', payload, {
  singletonKey: contentItemId
});
```

### Database Connection Issues

pg-boss automatically:
- Retries database connections
- Preserves jobs during downtime
- Resumes processing when connection recovers

### Graceful Shutdown

Next.js server shutdown:
- pg-boss completes in-progress jobs (10 min timeout)
- Releases active jobs back to queue
- Closes connections cleanly

## Testing Strategy

### Manual Testing with Existing Data

1. Deploy queue implementation
2. Visit `/admin/queue` dashboard
3. Verify stats show 697 pending items
4. Click "Enqueue All Pending Items"
5. Confirm 697 jobs queued
6. Monitor dashboard as items process
7. Verify successful items show as "indexed" in content table
8. Check failed items have error messages

### CSV Import Testing

1. Import CSV with 50 items
2. Verify first 10 indexed synchronously
3. Verify remaining 40 queued
4. Monitor queue processes all 40 items
5. Verify all items eventually indexed or failed

### Error Scenario Testing

1. Import URLs that will fail (404s, invalid domains)
2. Verify jobs retry 3 times with backoff
3. Verify items marked as failed with error messages
4. Test "Retry Failed Jobs" button

### Concurrency Testing

1. Enqueue 100+ items
2. Monitor that 5 workers process concurrently
3. Verify no race conditions or duplicate processing

## Performance Characteristics

**Processing time estimates (5 concurrent workers):**
- 100 items: ~20 minutes
- 697 items: ~140 minutes (2-3 hours)
- 1000 items: ~200 minutes (~3.5 hours)

**Average indexing time per item:** ~1 minute including:
- Content fetch: 10-30 seconds
- Chunking: 1-5 seconds
- Embedding generation: 5-15 seconds
- Database writes: 1-2 seconds

**Failure overhead:**
- Transient failure: +37 minutes (5min + 30min + 2hr delays)
- Permanent failure: immediate (no retries)

## Database Schema Changes

None required. pg-boss creates its own `pgboss` schema:
- `pgboss.job` - active and future jobs
- `pgboss.archive` - completed and failed jobs (retained 24hrs)
- `pgboss.schedule` - scheduled jobs
- `pgboss.subscription` - worker subscriptions

## Dependencies

**New:**
- `pg-boss` - PostgreSQL-based job queue

**Existing:**
- PostgreSQL/TimescaleDB (already in use)
- Existing indexing infrastructure (indexSingleItem, content-fetcher, etc.)

## Migration Path

### Deploying to Production

1. **Install dependency:**
   ```bash
   npm install pg-boss
   ```

2. **Deploy code:** Worker starts automatically on Next.js launch

3. **Process existing backlog:**
   - Visit `/admin/queue`
   - Click "Enqueue All Pending Items"
   - Monitor progress

4. **Future imports:** Auto-enqueue items >10

### Rollback Plan

If issues arise:
1. Stop the Next.js server (stops worker)
2. Revert code deployment
3. Pending items remain in database (can be manually re-indexed)
4. No data loss (jobs preserved in pgboss.archive)

## Future Enhancements

### Separate Worker Process (Phase 2)

If horizontal scaling needed:

1. Add env var: `ENABLE_EMBEDDED_WORKER=false`
2. Skip worker startup in Next.js when disabled
3. Run separate process: `npm run worker`
4. Deploy worker to separate instance

**When needed:**
- Multiple Vercel instances (horizontal scaling)
- Very high import volume (>5000 items regularly)
- Need to scale queue processing independently

### Progress Tracking (Phase 3)

Add real-time per-job progress:
- WebSocket updates for active jobs
- Live streaming of indexing progress
- Per-item status in content table

### Advanced Scheduling (Phase 4)

Add job priority and scheduling:
- High priority for user-triggered re-indexing
- Low priority for bulk imports
- Schedule indexing during off-peak hours

## Success Metrics

- ✅ 697 pending items successfully processed
- ✅ CSV imports >10 items auto-enqueue
- ✅ Dashboard shows real-time stats
- ✅ Failed items have clear error messages
- ✅ Retry logic handles transient failures
- ✅ No duplicate job processing
- ✅ Worker survives server restarts

## Open Questions

None - design approved.

## References

- [pg-boss Documentation](https://github.com/timgit/pg-boss)
- [GitHub Issue #3: Async indexing queue for bulk imports](https://github.com/mattstratton/tiger-den/issues/3)
- Existing code: `src/server/services/indexing-orchestrator.ts`

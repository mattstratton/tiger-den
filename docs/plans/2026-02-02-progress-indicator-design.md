# CSV Import Progress Indicator - Design Document

**Date:** 2026-02-02
**Feature:** Real-time progress updates during CSV import using Server-Sent Events

---

## Overview

Add real-time progress indicator to CSV import that shows current operation, row counts, percentage completion, and error accumulation. Users will see live updates as the import processes through enrichment, validation, and insertion phases.

## Design Decisions

### 1. Streaming Approach: Server-Sent Events (SSE)
**Decision:** Use SSE for real-time progress updates
**Rationale:**
- One-way communication (server → client) perfect for progress updates
- Built into browsers (EventSource API), no external dependencies
- Next.js route handlers support streaming responses natively
- Simpler than WebSockets, less overhead than polling
- Graceful degradation if connection drops

**Alternatives Considered:**
- Polling: Creates unnecessary API request overhead, less real-time
- WebSockets: Overkill for one-way updates, more complex infrastructure

### 2. Progress Granularity: Batched Updates (Every 10 Rows)
**Decision:** Send progress events every 10 rows processed
**Rationale:**
- Balances responsiveness with performance
- Reduces event spam for large imports (1000 rows = ~100 events vs 1000)
- Still feels responsive (update every 1-2 seconds for typical imports)
- Lower server/network overhead
- Enough detail to show progress through slow enrichment phase

**Alternatives Considered:**
- Every row: Too many events for large imports, network overhead
- Phase-based only: Not enough detail, users can't tell if it's stuck

### 3. Progress Information: Operation + Row Range + Percentage
**Decision:** Show current phase, row count, total, and calculated percentage
**Rationale:**
- Most informative - users know exactly what's happening
- Different phases (enrichment vs validation) have very different speeds
- Percentage gives visual feedback via progress bar
- Row count shows absolute progress
- Helps set expectations (enrichment is slower than validation)

**Example Display:**
- "Enriching titles: 15/100 rows (15%) - 2 errors"
- "Validating: 85/100 rows (85%) - 2 errors"
- "Inserting: 100/100 rows (100%) - 2 errors"

### 4. Error Handling: Continue on Error, Show Error Count
**Decision:** Continue processing on validation errors, show accumulating error count
**Rationale:**
- Matches current resilient import behavior (don't stop on first error)
- Users see problems accumulating without import stopping
- Final summary shows all errors at the end (existing behavior)
- More useful than stopping at first error (especially for row 95 of 100)

**Error Display:**
- Real-time: "Validating: 45/100 rows (45%) - 3 errors"
- Final: Complete error list with row numbers and messages (existing UI)

---

## Architecture

### High-Level Flow

```
User uploads CSV
    ↓
Frontend parses CSV with Papa Parse
    ↓
Generate unique session ID
    ↓
POST rows to /api/csv/start-import (with session ID)
    ↓
Open EventSource connection to /api/csv/import-stream?session={id}
    ↓
Backend processes rows, emits events every 10 rows:
  - Phase: enriching/validating/inserting
  - Current row number
  - Total rows
  - Percentage
  - Error count
    ↓
Frontend receives events, updates progress UI
    ↓
Backend sends 'complete' event with final results
    ↓
EventSource connection closes
    ↓
Frontend displays final summary (existing UI)
```

### Components

#### 1. SSE Route Handler
**File:** `src/app/api/csv/import-stream/route.ts`
**Purpose:** Stream progress events to client
**Responsibilities:**
- Accept session ID query parameter
- Open SSE connection with proper headers
- Look up session data (CSV rows)
- Process rows, emit progress events
- Send keep-alive pings every 30 seconds
- Close connection on completion or error

#### 2. Import Starter Endpoint
**File:** `src/app/api/csv/start-import/route.ts`
**Purpose:** Receive CSV data and initialize import session
**Responsibilities:**
- Generate unique session ID
- Store CSV rows temporarily (in-memory cache or Redis)
- Return session ID to frontend
- Set session expiration (15 minutes)

#### 3. Progress State Manager
**File:** `src/app/content/_components/import-csv-dialog.tsx` (modified)
**Purpose:** Manage EventSource connection and progress state
**Responsibilities:**
- Generate session ID
- Send CSV data to start-import endpoint
- Open EventSource connection
- Listen for progress events
- Update progress state
- Handle connection errors
- Close connection on completion

#### 4. Progress UI Component
**File:** `src/app/content/_components/import-csv-dialog.tsx` (modified)
**Purpose:** Display real-time progress
**Responsibilities:**
- Show progress bar (0-100%)
- Display current operation and row count
- Show error badge if errors > 0
- Animate phase transitions
- Display final results on completion

---

## Data Structures

### Progress Event

```typescript
interface ProgressEvent {
  type: 'progress' | 'complete' | 'error';
  phase: 'enriching' | 'validating' | 'inserting';
  current: number;        // Current row processed
  total: number;          // Total rows in import
  percentage: number;     // Calculated: (current / total) * 100
  errorCount: number;     // Errors encountered so far
  message: string;        // Human-readable: "Enriching titles: 15/100 rows (15%) - 2 errors"
}
```

### Complete Event

```typescript
interface CompleteEvent {
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
```

### Error Event

```typescript
interface ErrorEvent {
  type: 'error';
  message: string;
  code?: string;
}
```

### Session Data

```typescript
interface ImportSession {
  id: string;
  rows: Array<Record<string, unknown>>;
  createdAt: Date;
  expiresAt: Date;
}
```

---

## Implementation Details

### Backend: SSE Route Handler

**File:** `src/app/api/csv/import-stream/route.ts`

**Key Implementation:**

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session');

  // Verify session and get rows
  const session = await getImportSession(sessionId);
  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

  // Set up SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send event
      const sendEvent = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Keep-alive interval
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'));
      }, 30000);

      try {
        // Process rows with progress emission
        await processImportWithProgress(session.rows, sendEvent);
      } catch (error) {
        sendEvent({ type: 'error', message: error.message });
      } finally {
        clearInterval(keepAlive);
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Progress Emission Logic:**

```typescript
async function processImportWithProgress(
  rows: any[],
  sendEvent: (data: any) => void
) {
  const total = rows.length;
  let current = 0;
  let errorCount = 0;
  const errors = [];

  // Phase 1: Enrichment
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Enrich title if blank
    if (!row.title || row.title.trim() === '') {
      const title = await fetchPageTitle(row.current_url);
      if (title) row.title = title;
    }

    current++;

    // Emit progress every 10 rows
    if (current % 10 === 0 || current === total) {
      sendEvent({
        type: 'progress',
        phase: 'enriching',
        current,
        total,
        percentage: Math.round((current / total) * 100),
        errorCount,
        message: `Enriching titles: ${current}/${total} rows (${Math.round((current / total) * 100)}%)${errorCount > 0 ? ` - ${errorCount} errors` : ''}`,
      });
    }
  }

  // Reset for validation phase
  current = 0;

  // Phase 2: Validation & Insertion
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      // Validate and insert (existing logic)
      await validateAndInsertRow(row);
    } catch (error) {
      errorCount++;
      errors.push({
        row: i + 2,
        message: error.message,
      });
    }

    current++;

    // Emit progress every 10 rows
    if (current % 10 === 0 || current === total) {
      sendEvent({
        type: 'progress',
        phase: 'validating',
        current,
        total,
        percentage: Math.round((current / total) * 100),
        errorCount,
        message: `Validating: ${current}/${total} rows (${Math.round((current / total) * 100)}%)${errorCount > 0 ? ` - ${errorCount} errors` : ''}`,
      });
    }
  }

  // Send completion event
  sendEvent({
    type: 'complete',
    successful: total - errorCount,
    failed: errorCount,
    errors,
  });
}
```

### Frontend: EventSource Connection

**File:** `src/app/content/_components/import-csv-dialog.tsx`

**New State:**

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

**Import Handler:**

```typescript
const handleImport = async (file: File) => {
  // Parse CSV
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      const rows = results.data;

      // Generate session ID
      const sessionId = crypto.randomUUID();

      // Start import (send rows to backend)
      await fetch('/api/csv/start-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, rows }),
      });

      // Open SSE connection
      const es = new EventSource(`/api/csv/import-stream?session=${sessionId}`);

      es.onmessage = (event) => {
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
          setResult(data);
          setProgress(null);
          es.close();
        } else if (data.type === 'error') {
          setError(data.message);
          setProgress(null);
          es.close();
        }
      };

      es.onerror = () => {
        es.close();
        setError('Connection lost. Import may still be processing...');
        setProgress(null);
      };

      setEventSource(es);
      setImporting(true);
    },
  });
};
```

**Cleanup:**

```typescript
useEffect(() => {
  return () => {
    if (eventSource) {
      eventSource.close();
    }
  };
}, [eventSource]);
```

### Frontend: Progress UI

**Progress Bar Component:**

```tsx
{progress && (
  <div className="space-y-2">
    {/* Progress Bar */}
    <div className="w-full bg-secondary rounded-full h-2">
      <div
        className="bg-primary h-2 rounded-full transition-all duration-300"
        style={{ width: `${progress.percentage}%` }}
      />
    </div>

    {/* Status Text */}
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{progress.message}</span>
      {progress.errorCount > 0 && (
        <Badge variant="destructive">{progress.errorCount} errors</Badge>
      )}
    </div>

    {/* Phase Indicator */}
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {progress.phase === 'enriching' && <Loader2 className="h-3 w-3 animate-spin" />}
      {progress.phase === 'validating' && <CheckCircle2 className="h-3 w-3" />}
      {progress.phase === 'inserting' && <Database className="h-3 w-3" />}
      <span className="capitalize">{progress.phase}</span>
    </div>
  </div>
)}
```

---

## Error Handling

### SSE Connection Failures

**Scenario:** Connection drops mid-import

**Handling:**
1. Frontend detects `onerror` event on EventSource
2. Display message: "Connection lost. Import may still be processing..."
3. Attempt to reconnect with same session ID (optional)
4. If reconnect fails, show error state with retry button
5. Import continues on backend (or option to cancel via separate endpoint)

### Backend Errors During Processing

**Scenario:** Server crashes or exception during import

**Handling:**
1. Try-catch around processing logic
2. Send 'error' event to client with error message
3. Rollback database transaction
4. Close SSE connection
5. Clean up session data
6. Frontend displays error, allows retry

### Validation Errors (Expected)

**Scenario:** Row fails validation (duplicate URL, invalid data)

**Handling:**
1. Continue processing (resilient import)
2. Increment error counter
3. Store error details for final summary
4. Emit progress event with updated error count
5. Final 'complete' event includes full error list

### Browser/Network Issues

**Scenario:** User closes dialog during import

**Options:**
- **Option A:** Cancel import when dialog closes (clean up session)
- **Option B:** Continue import in background, allow status check later

**Recommendation:** Option A (cancel on close) for simpler implementation

**Implementation:**
```typescript
const handleClose = () => {
  if (eventSource) {
    eventSource.close();
    // Optionally: Send cancel request to backend
    fetch('/api/csv/cancel-import', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  }
  setProgress(null);
  onOpenChange(false);
};
```

### Session Management

**Session Lifecycle:**
1. Created when CSV upload starts
2. Expires after 15 minutes
3. Cleaned up after completion or expiration
4. Stored in-memory (or Redis for production)

**Session Storage:**

```typescript
// Simple in-memory store (development)
const sessions = new Map<string, ImportSession>();

// Set expiration
const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

// Clean up expired sessions periodically
setInterval(() => {
  const now = new Date();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(id);
    }
  }
}, 60000); // Every minute
```

---

## Testing Strategy

### Manual Testing Scenarios

#### 1. Small Import (5-10 rows)
**Purpose:** Verify basic functionality
**Steps:**
1. Upload test CSV with 5-10 rows
2. Verify progress updates appear
3. Check progress bar animates smoothly
4. Confirm percentage calculation accurate
5. Verify final results display correctly

**Expected:**
- Progress updates visible for both phases
- Smooth transition from enriching → validating
- Final summary matches expected results

#### 2. Medium Import (50-100 rows)
**Purpose:** Test batched updates and phase transitions
**Steps:**
1. Upload test CSV with 50-100 rows
2. Verify updates appear every 10 rows
3. Watch phase transitions (enriching → validating)
4. Include some blank titles and pre-filled titles
5. Include some intentional errors (duplicates)

**Expected:**
- Updates every ~1-2 seconds during enrichment
- Faster updates during validation
- Error count increments correctly
- Final error list matches error count

#### 3. Large Import (500-1000 rows)
**Purpose:** Test SSE connection stability and performance
**Steps:**
1. Upload test CSV with 500-1000 rows (max)
2. Verify SSE connection stays alive (10+ minutes)
3. Check keep-alive pings prevent timeout
4. Monitor browser memory usage
5. Verify final results accurate

**Expected:**
- Connection stable throughout import
- No memory leaks or performance degradation
- Progress updates consistent
- UI remains responsive

#### 4. Error Scenarios
**Purpose:** Test error handling and resilience
**Steps:**
1. Import with duplicate URLs (within CSV and in DB)
2. Import with invalid content types
3. Import with malformed dates
4. Verify error count updates in real-time
5. Check final error summary displays all issues

**Expected:**
- Import continues despite errors
- Error count increments correctly
- All errors listed in final summary
- Successful rows inserted to database

#### 5. Connection Issues
**Purpose:** Test graceful degradation
**Steps:**
1. Start import, refresh page mid-import
2. Start import, close dialog mid-import
3. Simulate slow network (DevTools throttling)
4. Test with flaky connection

**Expected:**
- Graceful error messages
- No partial/corrupt data in database
- Clear user feedback on connection loss
- Option to retry import

### Test Files

**Reuse Existing:**
- `test-csvs/scenario1-blank-titles.csv` (3 rows)
- `test-csvs/scenario2-mixed-titles.csv` (4 rows)

**Create New:**
- `test-csvs/progress-medium.csv` (100 rows)
- `test-csvs/progress-large.csv` (500 rows)
- `test-csvs/progress-errors.csv` (50 rows with intentional errors)

**Test CSV Generator Script:**

```typescript
// scripts/generate-test-csv.ts
const rows = [];
for (let i = 1; i <= 100; i++) {
  rows.push({
    title: i % 3 === 0 ? '' : `Test Content ${i}`,
    current_url: `https://example.com/content-${i}`,
    content_type: 'blog_post',
    publish_date: '2024-01-01',
    description: `Test description ${i}`,
    author: 'Test Author',
    target_audience: 'developers',
    campaigns: 'Test Campaign',
  });
}
// Convert to CSV and save
```

### Success Criteria

✅ Progress updates appear within 1-2 seconds of each batch
✅ Percentage calculation accurate (matches current/total)
✅ Error count matches final error list
✅ Phase transitions visible (enriching → validating → inserting)
✅ Progress bar animates smoothly
✅ No UI freezing or blocking during import
✅ SSE connection stable for 10+ minute imports
✅ Keep-alive pings prevent connection timeout
✅ Graceful error handling on connection loss
✅ Final results display correctly
✅ No memory leaks or performance issues

---

## Performance Considerations

### SSE Connection Overhead

**Network Traffic:**
- ~100 events for 1000-row import (batched every 10 rows)
- Each event ~200 bytes (JSON)
- Total: ~20 KB of progress data
- Negligible compared to CSV upload size

**Server Resources:**
- One open connection per active import
- Keep-alive pings every 30 seconds
- Connection closes after completion (~10 minutes max)
- Memory: Session data stored temporarily (~1 MB per 1000 rows)

**Scalability:**
- Concurrent imports limited by server capacity
- Consider connection pooling for high traffic
- Redis for session storage in production (vs in-memory)

### Client-Side Performance

**EventSource API:**
- Built into browsers, minimal overhead
- Automatic reconnection on connection loss
- Efficient event parsing

**React State Updates:**
- Progress state updates every 10 rows (not every row)
- UI re-renders minimal (only progress component)
- No performance impact on large imports

### Database Performance

**No Change:**
- Database operations unchanged from current implementation
- Batch inserts still possible
- Progress emission adds negligible overhead

---

## Security Considerations

### Session ID Generation

**Use cryptographically secure random IDs:**
```typescript
const sessionId = crypto.randomUUID(); // Built-in Web Crypto API
```

**Prevent session guessing:**
- 128-bit random IDs (UUID v4)
- Short expiration (15 minutes)
- Clean up expired sessions

### Authentication

**Verify user authentication for SSE endpoint:**
```typescript
// In route handler
const session = await auth();
if (!session?.user) {
  return new Response('Unauthorized', { status: 401 });
}
```

**Session ownership:**
- Store user ID with session
- Verify user owns session before streaming

### Rate Limiting

**Prevent abuse:**
- Limit concurrent imports per user (e.g., 1 at a time)
- Rate limit session creation (e.g., 10 per hour)
- Monitor for suspicious patterns

### Data Sanitization

**Already handled:**
- CSV data validated with Zod schemas
- SQL injection prevented by Drizzle ORM
- No change to existing validation logic

---

## Future Enhancements (Out of Scope)

### Pausable Imports
- Add pause/resume functionality
- Store import state in session
- UI controls for pause/cancel

### Import History
- Store import results in database
- View past imports and results
- Re-download error CSVs

### Parallel Processing
- Process multiple rows in parallel
- Requires connection pooling for enrichment
- More complex progress tracking

### Real-Time Row-by-Row Updates
- Send event for every single row
- More granular progress
- Higher network overhead

### Import Queue
- Queue multiple imports
- Process sequentially or in parallel
- Dashboard for import status

### CSV Preview Before Import
- Show first 10 rows before importing
- Confirm column mapping
- Adjust settings (date format, etc.)

---

*Design validated and approved: 2026-02-02*

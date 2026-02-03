import { NextRequest } from 'next/server';
import { auth } from '~/server/auth';
import { db } from '~/server/db';
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

    const userId = session.user.id;

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
    if (importSession.userId !== userId) {
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

        let errorCount = 0;

        try {
          // Process import with progress events
          const result = await processImportWithProgress(
            importSession.rows,
            userId,
            db,
            (progressEvent) => {
              // Transform processor progress event to SSE format
              sendEvent({
                type: 'progress',
                phase: progressEvent.phase === 'enriching' ? 'enriching' : 'inserting',
                current: progressEvent.current,
                total: progressEvent.total,
                percentage: Math.round((progressEvent.current / progressEvent.total) * 100),
                errorCount,
                message: progressEvent.message,
              });
            }
          );

          // Update error count from result
          errorCount = result.failed;

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

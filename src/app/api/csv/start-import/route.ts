import { type NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { createSession } from "~/server/services/import-session-storage";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { sessionId, rows } = body;

    if (!sessionId || !rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    // Create session
    createSession(sessionId, session.user.id, rows);
    console.log(
      `[start-import] Created session ${sessionId} for user ${session.user.id} with ${rows.length} rows`,
    );

    return NextResponse.json({ success: true, sessionId });
  } catch (error) {
    console.error("Error starting import:", error);
    return NextResponse.json(
      { error: "Failed to start import" },
      { status: 500 },
    );
  }
}

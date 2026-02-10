import { NextResponse } from "next/server";
import { runEnabledImports } from "~/server/services/scheduled-import-runner";

/**
 * Vercel Cron handler for scheduled API imports.
 * Runs all enabled sources with incremental (since last success) logic.
 *
 * Secured via CRON_SECRET — Vercel sets this automatically for cron jobs.
 * In dev, call directly: curl http://localhost:3000/api/cron/import
 */
export async function GET(request: Request) {
  // Verify the request is from Vercel Cron (production) or allow in dev
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await runEnabledImports();
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("[Cron] Import route failed:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}

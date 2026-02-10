export async function register() {
  // Only run on the Node.js runtime (not edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamic imports keep node-only modules out of the edge bundle
    const { sql } = await import("drizzle-orm");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const { db } = await import("~/server/db");

    try {
      await ensureBaseline(db, sql);

      await migrate(db, {
        migrationsFolder: `${process.cwd()}/drizzle`,
        migrationsSchema: "tiger_den",
      });
      console.log("[Migrate] Migrations applied successfully");
    } catch (error) {
      console.error("[Migrate] Migration failed:", error);
    }
  }
}

/**
 * Migrations 0000–0009 were applied before auto-migration was enabled
 * (via db:push or manual SQL). The drizzle migrator tracks applied migrations
 * in a __drizzle_migrations table. Without a baseline, it would try to re-run
 * everything from 0000 and fail on "already exists" errors.
 *
 * This function detects existing databases (tiger_den.users exists) that lack
 * the tracking table, creates it, and seeds entries for already-applied
 * migrations. Fresh databases skip this so all migrations run normally.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureBaseline(db: any, sql: any) {
  // Check if tiger_den.users exists (created by migration 0000)
  const existsResult = (await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'tiger_den' AND table_name = 'users'
    ) AS "exists"
  `)) as unknown as Array<{ exists: boolean }>;

  const isExistingDb = existsResult[0]?.exists === true;
  if (!isExistingDb) return; // Fresh DB — let all migrations run normally

  // Check if the tracking table has entries. It may not exist yet (fresh DB
  // where migrate() hasn't run), or it may be empty (prior failed run created
  // the table but never committed entries).
  try {
    const countResult = (await db.execute(sql`
      SELECT count(*)::int AS "count"
      FROM tiger_den."__drizzle_migrations"
    `)) as unknown as Array<{ count: number }>;

    if ((countResult[0]?.count ?? 0) > 0) return; // Already baselined
  } catch {
    // Table doesn't exist yet — that's fine, migrate() will create it
  }

  // Ensure the tracking table exists (it may not if this is the first run)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tiger_den."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL,
      created_at BIGINT
    )
  `);

  const baseline = [
    { hash: "0000_strong_shockwave", ts: 1770047594600 },
    { hash: "0001_youthful_kree", ts: 1770048187661 },
    { hash: "0002_nextauth_migration", ts: 1770101400000 },
    { hash: "0003_fix_expires_at_and_email", ts: 1770104000000 },
    { hash: "0004_add_content_text_table", ts: 1770106000000 },
    { hash: "0005_add_content_chunks_table", ts: 1770108000000 },
    { hash: "0006_add_search_path", ts: 1738703950000 },
    { hash: "0007_add_rbac_and_content_types", ts: 1738776000000 },
    { hash: "0008_add_api_integration_fields", ts: 1738786200000 },
    { hash: "0009_add_youtube_fields", ts: 1738872600000 },
  ];

  for (const m of baseline) {
    await db.execute(sql`
      INSERT INTO tiger_den."__drizzle_migrations" (hash, created_at)
      VALUES (${m.hash}, ${m.ts})
    `);
  }

  console.log("[Migrate] Seeded baseline for existing database (0000–0009)");
}

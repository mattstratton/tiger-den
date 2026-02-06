/**
 * Bulk re-index all content items with improved extraction
 * Run with: npx tsx scripts/bulk-reindex.ts
 */

import { db } from "../src/server/db";
import { indexSingleItem } from "../src/server/services/indexing-orchestrator";

async function bulkReindex() {
  console.log("🔍 Fetching all content items...\n");

  const items = await db.query.contentItems.findMany({
    columns: {
      id: true,
      currentUrl: true,
      title: true,
    },
  });

  console.log(`Found ${items.length} content items to re-index`);
  console.log("📝 Starting bulk re-index (processing all items synchronously)...\n");

  let succeeded = 0;
  let failed = 0;
  const errors: Array<{ title: string; error: string }> = [];

  // Process all items synchronously with progress indicator
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const progress = `[${i + 1}/${items.length}]`;

    process.stdout.write(`${progress} ${item.title.substring(0, 60)}... `);

    try {
      const result = await indexSingleItem(item.id, item.currentUrl);

      if (result.success) {
        succeeded++;
        console.log("✅");
      } else {
        failed++;
        errors.push({ title: item.title, error: result.error || "Unknown error" });
        console.log(`❌ ${result.error}`);
      }
    } catch (error) {
      failed++;
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push({ title: item.title, error: errorMsg });
      console.log(`❌ ${errorMsg}`);
    }

    // Small delay to avoid overwhelming the OpenAI API
    if (i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("📊 Re-indexing Summary");
  console.log("=".repeat(70));
  console.log(`Total items:    ${items.length}`);
  console.log(`✅ Succeeded:   ${succeeded}`);
  console.log(`❌ Failed:      ${failed}`);
  console.log("=".repeat(70));

  if (errors.length > 0) {
    console.log("\n⚠️  Failed Items:");
    errors.slice(0, 10).forEach(({ title, error }) => {
      console.log(`\n  - ${title}`);
      console.log(`    Error: ${error}`);
    });
    if (errors.length > 10) {
      console.log(`\n  ... and ${errors.length - 10} more failures`);
    }
  }

  console.log("\n✨ Re-indexing complete!");

  process.exit(0);
}

bulkReindex().catch((error) => {
  console.error("Bulk re-index failed:", error);
  process.exit(1);
});

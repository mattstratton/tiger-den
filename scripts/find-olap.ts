import { like } from "drizzle-orm";
import { db } from "../src/server/db";
import { contentItems } from "../src/server/db/schema";

async function findOlap() {
  const items = await db
    .select({
      id: contentItems.id,
      title: contentItems.title,
      currentUrl: contentItems.currentUrl,
    })
    .from(contentItems)
    .where(like(contentItems.title, "%OLAP%"));

  console.log(`Found ${items.length} items with "OLAP" in title:\n`);

  for (const item of items) {
    console.log("Title:", item.title);
    console.log("URL:", item.currentUrl);
    console.log("ID:", item.id);

    // Check if it has content text
    const result = await db.execute<{ chunk_count: number }>(
      `SELECT COUNT(*) as chunk_count
       FROM tiger_den.content_chunks cc
       JOIN tiger_den.content_text ct ON ct.id = cc.content_text_id
       WHERE ct.content_item_id = '${item.id}'`
    );

    console.log("Chunks:", (result as any)[0]?.chunk_count ?? 0);
    console.log("-".repeat(70));
  }

  process.exit(0);
}

findOlap();

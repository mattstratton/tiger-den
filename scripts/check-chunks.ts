import { eq, sql } from "drizzle-orm";
import { db } from "../src/server/db";
import { contentItems, contentText, contentChunks } from "../src/server/db/schema";

async function checkChunks() {
  // Find the content item
  const item = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.title, "How to Choose an OLAP Database | Tiger Data"))
    .limit(1);

  if (!item || item.length === 0) {
    console.log("Item not found");
    process.exit(1);
  }

  const contentItem = item[0]!;

  // Get associated content text
  const text = await db
    .select()
    .from(contentText)
    .where(eq(contentText.contentItemId, contentItem.id))
    .limit(1);

  if (!text || text.length === 0) {
    console.log("No content text found");
    process.exit(1);
  }

  const contentTextData = text[0]!;

  // Get chunks
  const chunks = await db
    .select()
    .from(contentChunks)
    .where(eq(contentChunks.contentTextId, contentTextData.id));

  console.log("Title:", contentItem.title);
  console.log("Content Text ID:", contentTextData.id);
  console.log("Content Text Status:", contentTextData.indexStatus);
  console.log("Number of chunks:", chunks.length);

  if (chunks.length > 0) {
    console.log("\nFirst chunk text:");
    console.log("=".repeat(70));
    console.log(chunks[0]?.chunkText.substring(0, 500));
    console.log("=".repeat(70));

    console.log("\nChunk has embedding:", chunks[0]?.embedding !== null);
  }

  process.exit(0);
}

checkChunks();

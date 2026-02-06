import { eq } from "drizzle-orm";
import { db } from "../src/server/db";
import { contentItems, contentText, contentChunks } from "../src/server/db/schema";

async function checkOlapChunks() {
  const itemId = "22633874-5382-459d-baa4-7cc0223ced28"; // The one with 4 chunks

  // Get the item
  const item = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, itemId))
    .limit(1);

  console.log("Title:", item[0]?.title);
  console.log("URL:", item[0]?.currentUrl);

  // Get content text
  const text = await db
    .select()
    .from(contentText)
    .where(eq(contentText.contentItemId, itemId))
    .limit(1);

  console.log("\nContent status:", text[0]?.indexStatus);
  console.log("Indexed at:", text[0]?.indexedAt);
  console.log("Plain text length:", text[0]?.plainText.length);

  if (text[0]) {
    // Get first chunk
    const chunks = await db
      .select()
      .from(contentChunks)
      .where(eq(contentChunks.contentTextId, text[0].id))
      .limit(1);

    if (chunks[0]) {
      console.log("\n=== First Chunk Content (first 800 chars) ===");
      console.log(chunks[0].chunkText.substring(0, 800));
      console.log("=".repeat(70));

      console.log("\nHas embedding:", chunks[0].embedding !== null);
    }
  }

  process.exit(0);
}

checkOlapChunks();

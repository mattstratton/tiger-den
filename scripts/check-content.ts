import { eq, sql } from "drizzle-orm";
import { db } from "../src/server/db";
import { contentItems, contentText } from "../src/server/db/schema";

async function checkContent() {
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

  console.log("Title:", contentItem.title);
  console.log("URL:", contentItem.currentUrl);
  console.log("\nContent Text Status:", contentTextData.indexStatus);
  console.log("Indexed At:", contentTextData.indexedAt);
  console.log("Text Length:", contentTextData.plainText.length);
  console.log("\nFirst 1000 characters of plain text:");
  console.log("=".repeat(70));
  console.log(contentTextData.plainText.substring(0, 1000));
  console.log("=".repeat(70));

  process.exit(0);
}

checkContent();

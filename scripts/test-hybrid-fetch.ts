/**
 * Test hybrid content fetching
 */

import { fetchContent } from "../src/server/services/content-fetcher";
import { closeBrowser } from "../src/server/services/browser-content-fetcher";

async function testHybridFetch() {
  const testUrls = [
    "https://www.timescale.com/blog/when-boring-is-awesome",
    "https://www.timescale.com/blog/13-tips-to-improve-postgresql-insert-performance",
  ];

  for (const url of testUrls) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`Testing: ${url}`);
    console.log("=".repeat(80));

    try {
      const startTime = Date.now();
      const result = await fetchContent(url);
      const elapsed = Date.now() - startTime;

      console.log(`\n✅ Success in ${elapsed}ms`);
      console.log(`Word count: ${result.wordCount}`);
      console.log(`Token count: ${result.tokenCount}`);
      console.log(`\nFirst 400 characters:`);
      console.log(result.plainText.substring(0, 400));
      console.log(`\n...`);
      console.log(`Last 200 characters:`);
      console.log(result.plainText.substring(result.plainText.length - 200));
    } catch (error) {
      console.error(`\n❌ Failed:`, error instanceof Error ? error.message : error);
    }
  }

  // Cleanup
  await closeBrowser();
  console.log(`\n${"=".repeat(80)}`);
  console.log("Test complete!");
}

testHybridFetch().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});

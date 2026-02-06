/**
 * Test if tigerdata.com URLs work with static extraction
 */

import { fetchContent } from "../src/server/services/content-fetcher";
import { closeBrowser } from "../src/server/services/browser-content-fetcher";

async function testTigerDataUrls() {
  const testUrls = [
    "https://www.tigerdata.com/blog/introducing-agentic-postgres-free-plan-experiment-ai-on-postgres",
    "https://www.tigerdata.com/blog/postgresql-couldnt-handle-our-time-series-data-timescaledb-crushed-it",
    "https://www.tigerdata.com/blog/tiger-lake-a-new-architecture-for-real-time-analytical-systems-and-agents",
  ];

  let staticSuccess = 0;
  let browserFallback = 0;

  for (const url of testUrls) {
    console.log(`\nTesting: ${url.split('/blog/')[1]}`);

    try {
      const startTime = Date.now();
      const result = await fetchContent(url);
      const elapsed = Date.now() - startTime;

      // Check if browser was used (browser takes >2s typically)
      const usedBrowser = elapsed > 2000;

      if (usedBrowser) {
        browserFallback++;
        console.log(`  ⚠️  Browser fallback (${elapsed}ms) - ${result.wordCount} words`);
      } else {
        staticSuccess++;
        console.log(`  ✅ Static success (${elapsed}ms) - ${result.wordCount} words`);
      }

      // Show first 200 chars to verify content quality
      console.log(`  Preview: ${result.plainText.substring(0, 200)}...`);
    } catch (error) {
      console.error(`  ❌ Failed:`, error instanceof Error ? error.message : error);
    }
  }

  await closeBrowser();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${staticSuccess} static, ${browserFallback} browser`);
  console.log(`Static success rate: ${Math.round(staticSuccess / testUrls.length * 100)}%`);
}

testTigerDataUrls().catch(console.error);

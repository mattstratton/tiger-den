/**
 * Test actual URL from database
 */

import { fetchContent } from "../src/server/services/content-fetcher";

async function test() {
  const url = "https://www.timescale.com/blog/when-boring-is-awesome-building-a-scalable-time-series-database-on-postgresql-2900ea453ee2";

  console.log(`Testing: ${url}\n`);

  const result = await fetchContent(url);

  console.log(`Word count: ${result.wordCount}`);
  console.log(`\nFirst 500 chars:`);
  console.log(result.plainText.substring(0, 500));
}

test().catch(console.error);

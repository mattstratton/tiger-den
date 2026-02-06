/**
 * Test Content Sync Service
 * Run with: npx tsx --env-file=.env scripts/test-content-sync.ts
 */

import { ghostClient } from "../src/server/services/ghost-api-client";
import { contentfulClient } from "../src/server/services/contentful-api-client";
import { contentSyncService } from "../src/server/services/content-sync-service";

async function testSync() {
  console.log("=".repeat(70));
  console.log("Testing Content Sync Service");
  console.log("=".repeat(70));

  // Test Ghost sync
  console.log("\n📝 Testing Ghost Post Sync...");
  console.log("-".repeat(70));

  if (!ghostClient.isEnabled()) {
    console.log("❌ Ghost API not configured");
  } else {
    try {
      // Fetch a small batch of posts
      const posts = await ghostClient.fetchAllPosts({ limit: 5 });
      console.log(`\n📊 Fetched ${posts.posts.length} posts from Ghost`);

      // Sync them
      const ghostResult = await contentSyncService.syncGhostPosts(posts.posts);
      console.log("\n✅ Ghost Sync Results:");
      console.log(`  Created: ${ghostResult.created}`);
      console.log(`  Updated: ${ghostResult.updated}`);
      console.log(`  Skipped: ${ghostResult.skipped}`);
      console.log(`  Failed: ${ghostResult.failed}`);

      if (ghostResult.errors.length > 0) {
        console.log("\n❌ Errors:");
        ghostResult.errors.forEach((err) => {
          console.log(`  - ${err.item}: ${err.error}`);
        });
      }
    } catch (error) {
      console.log(
        `❌ Error syncing Ghost posts: ${error instanceof Error ? error.message : "Unknown"}`,
      );
    }
  }

  // Test Contentful learn pages sync
  console.log("\n\n📚 Testing Contentful Learn Pages Sync...");
  console.log("-".repeat(70));

  if (!contentfulClient.isEnabled()) {
    console.log("❌ Contentful API not configured");
  } else {
    try {
      // Fetch a small batch of learn pages
      const learnPages = await contentfulClient.fetchLearnPages({ limit: 5 });
      console.log(`\n📊 Fetched ${learnPages.items.length} learn pages from Contentful`);

      // Sync them
      const learnResult = await contentSyncService.syncLearnPages(
        learnPages.items,
      );
      console.log("\n✅ Learn Pages Sync Results:");
      console.log(`  Created: ${learnResult.created}`);
      console.log(`  Updated: ${learnResult.updated}`);
      console.log(`  Skipped: ${learnResult.skipped}`);
      console.log(`  Failed: ${learnResult.failed}`);

      if (learnResult.errors.length > 0) {
        console.log("\n❌ Errors:");
        learnResult.errors.forEach((err) => {
          console.log(`  - ${err.item}: ${err.error}`);
        });
      }
    } catch (error) {
      console.log(
        `❌ Error syncing learn pages: ${error instanceof Error ? error.message : "Unknown"}`,
      );
    }
  }

  // Test Contentful case studies sync
  console.log("\n\n🏢 Testing Contentful Case Studies Sync...");
  console.log("-".repeat(70));

  if (!contentfulClient.isEnabled()) {
    console.log("❌ Contentful API not configured");
  } else {
    try {
      // Fetch a small batch of case studies
      const caseStudies = await contentfulClient.fetchCaseStudies({ limit: 5 });
      console.log(`\n📊 Fetched ${caseStudies.items.length} case studies from Contentful`);

      // Sync them
      const caseStudyResult = await contentSyncService.syncCaseStudies(
        caseStudies.items,
      );
      console.log("\n✅ Case Studies Sync Results:");
      console.log(`  Created: ${caseStudyResult.created}`);
      console.log(`  Updated: ${caseStudyResult.updated}`);
      console.log(`  Skipped: ${caseStudyResult.skipped}`);
      console.log(`  Failed: ${caseStudyResult.failed}`);

      if (caseStudyResult.errors.length > 0) {
        console.log("\n❌ Errors:");
        caseStudyResult.errors.forEach((err) => {
          console.log(`  - ${err.item}: ${err.error}`);
        });
      }
    } catch (error) {
      console.log(
        `❌ Error syncing case studies: ${error instanceof Error ? error.message : "Unknown"}`,
      );
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("✨ Sync Testing Complete");
  console.log("=".repeat(70));

  process.exit(0);
}

testSync().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

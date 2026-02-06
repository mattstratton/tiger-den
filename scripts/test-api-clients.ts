/**
 * Test Ghost and Contentful API clients
 * Run with: npx tsx --env-file=.env scripts/test-api-clients.ts
 */

import { ghostClient } from "../src/server/services/ghost-api-client";
import { contentfulClient } from "../src/server/services/contentful-api-client";

async function testAPIs() {
  console.log("=".repeat(70));
  console.log("Testing API Clients");
  console.log("=".repeat(70));

  // Test Ghost API
  console.log("\n📝 Testing Ghost API...");
  console.log("-".repeat(70));

  if (!ghostClient.isEnabled()) {
    console.log("❌ Ghost API not configured (missing env vars)");
  } else {
    // Test connection
    const ghostConnection = await ghostClient.testConnection();
    if (!ghostConnection.success) {
      console.log(`❌ Ghost connection failed: ${ghostConnection.error}`);
    } else {
      console.log("✅ Ghost API connected successfully");

      // Fetch one post as example
      try {
        const posts = await ghostClient.fetchAllPosts({ limit: 1 });
        if (posts.posts && posts.posts.length > 0) {
          const post = posts.posts[0]!;
          console.log("\n📄 Sample Ghost Post:");
          console.log(`  ID: ${post.id}`);
          console.log(`  Title: ${post.title}`);
          console.log(`  Slug: ${post.slug}`);
          console.log(`  URL: ${post.url}`);
          console.log(`  Published: ${post.published_at}`);
          console.log(`  Updated: ${post.updated_at}`);
          console.log(`  Author: ${post.primary_author?.name || "N/A"}`);
          console.log(`  Tags: ${post.tags?.map((t) => t.name).join(", ") || "None"}`);
          console.log(`  Excerpt: ${post.excerpt?.substring(0, 100) || "N/A"}...`);
          console.log(`  Plain text length: ${post.plaintext?.length || 0} chars`);

          // Get total count
          console.log(`\n📊 Total posts available: ${posts.meta.pagination.total}`);
        }
      } catch (error) {
        console.log(`❌ Error fetching posts: ${error instanceof Error ? error.message : "Unknown"}`);
      }
    }
  }

  // Test Contentful API
  console.log("\n\n🎨 Testing Contentful API...");
  console.log("-".repeat(70));

  if (!contentfulClient.isEnabled()) {
    console.log("❌ Contentful API not configured (missing env vars)");
  } else {
    // Test connection
    const contentfulConnection = await contentfulClient.testConnection();
    if (!contentfulConnection.success) {
      console.log(`❌ Contentful connection failed: ${contentfulConnection.error}`);
    } else {
      console.log("✅ Contentful API connected successfully");

      // Fetch one learn page as example
      try {
        const learnPages = await contentfulClient.fetchLearnPages({ limit: 1 });
        if (learnPages.items.length > 0) {
          const page = learnPages.items[0]!;
          console.log("\n📚 Sample Learn Page:");
          console.log(`  ID: ${page.sys.id}`);
          console.log(`  Title: ${page.fields.title}`);
          console.log(`  URL: ${page.fields.url}`);
          console.log(`  Section: ${page.fields.section || "N/A"}`);
          console.log(`  Sub Section: ${page.fields.subSection || "N/A"}`);
          console.log(`  Meta Title: ${page.fields.metaTitle || "N/A"}`);
          console.log(`  Meta Description: ${page.fields.metaDescription || "N/A"}`);
          console.log(`  Published: ${page.sys.publishedAt || "N/A"}`);
          console.log(`  Updated: ${page.sys.updatedAt}`);
          console.log(`  Content type: ${typeof page.fields.content}`);

          console.log(`\n📊 Total learn pages available: ${learnPages.total}`);
        }
      } catch (error) {
        console.log(`❌ Error fetching learn pages: ${error instanceof Error ? error.message : "Unknown"}`);
      }

      // Fetch one case study as example
      try {
        const caseStudies = await contentfulClient.fetchCaseStudies({ limit: 1 });
        if (caseStudies.items.length > 0) {
          const study = caseStudies.items[0]!;
          console.log("\n🏢 Sample Case Study:");
          console.log(`  ID: ${study.sys.id}`);
          console.log(`  Name: ${study.fields.name}`);
          console.log(`  Slug: ${study.fields.slug}`);
          console.log(`  External Link: ${study.fields.externalLink || "N/A"}`);
          console.log(`  Category: ${study.fields.category || "N/A"}`);
          console.log(`  Overview: ${study.fields.overview?.substring(0, 100) || "N/A"}...`);
          console.log(`  Published: ${study.sys.publishedAt || "N/A"}`);
          console.log(`  Updated: ${study.sys.updatedAt}`);
          console.log(`  Content type: ${typeof study.fields.content}`);

          console.log(`\n📊 Total case studies available: ${caseStudies.total}`);
        }
      } catch (error) {
        console.log(`❌ Error fetching case studies: ${error instanceof Error ? error.message : "Unknown"}`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("✨ API Testing Complete");
  console.log("=".repeat(70));

  process.exit(0);
}

testAPIs().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

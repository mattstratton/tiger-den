import axios from "axios";
import * as cheerio from "cheerio";

async function findLinkContainer() {
  const url = "https://www.tigerdata.com/learn/how-to-choose-an-olap-database";
  const response = await axios.get(url);
  const $ = cheerio.load(response.data);

  // Find the "Home" link that starts the navigation
  const homeLink = $('a:contains("Home")').filter(function () {
    return $(this).text().trim() === "Home";
  });

  console.log("Found", homeLink.length, "'Home' links");

  if (homeLink.length > 0) {
    // Get the one that's followed by "AWS Time-Series Database"
    homeLink.each((i, elem) => {
      const nextLink = $(elem).next("a");
      if (nextLink.text().includes("AWS Time-Series Database")) {
        console.log("\n=== Found the navigation Home link ===");
        console.log("Link text:", $(elem).text());

        // Get parent chain
        console.log("\n=== Parent Chain ===");
        let parent = $(elem).parent();
        for (let j = 0; j < 6 && parent.length > 0; j++) {
          const tag = parent.prop("tagName");
          const classes = parent.attr("class") || "none";
          const id = parent.attr("id") || "none";
          const text = parent
            .clone()
            .children()
            .remove()
            .end()
            .text()
            .trim()
            .substring(0, 50);

          console.log(`Level ${j + 1}: <${tag}> class="${classes}" id="${id}"`);
          console.log(`  Direct text: "${text}"`);

          // Check if this is a nav, aside, or has nav-related classes
          if (
            tag === "NAV" ||
            tag === "ASIDE" ||
            classes.includes("nav") ||
            classes.includes("menu") ||
            classes.includes("sidebar")
          ) {
            console.log(`  ⚠️ This looks like navigation!`);
          }

          parent = parent.parent();
        }
      }
    });
  }

  process.exit(0);
}

findLinkContainer();

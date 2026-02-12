# Tiger Den: LinkedIn Article Converter Implementation Spec

## Context

This document covers everything needed to extend Tiger Den to support an automated LinkedIn article conversion workflow. The end state: a team member opens Claude Code, says "convert this blog post for Matty's LinkedIn," and Claude Code pulls Matty's voice profile from Tiger Den, writes the article, then queries Tiger Den's content library for relevant CTAs and links. No static files, no copy-pasting, no manual maintenance.

Three pieces need to be built:

1. **Author profiles and writing samples** in Tiger Den (database tables, CRUD UI, tRPC procedures)
2. **MCP server** inside Tiger Den (API routes exposing two tools: content search and author profile retrieval)
3. **Claude Code skill** (a SKILL.md file that references the MCP tools instead of static files)

## Part 1: Author Profiles in Tiger Den

### Database Schema

Two new tables in the `tiger_den` schema. These follow the same patterns as existing Tiger Den tables (use `pgSchema()`, Drizzle ORM, etc).

#### `authors` table

| Column | Type | Notes |
|---|---|---|
| id | serial, PK | |
| name | text, not null, unique | Display name. Also the lookup key from the skill (e.g., "matty", "sarah"). Lowercase, no spaces. Think of it as a slug. |
| display_name | text, not null | Full display name (e.g., "Matty Stratton") |
| title | text | Job title (e.g., "Head of Developer Relations") |
| company | text | Default: "Tiger Data" |
| linkedin_url | text | Their LinkedIn profile URL |
| topics | text[] | Array of topics they cover (e.g., ["PostgreSQL performance", "time-series architecture"]) |
| voice_notes | text, not null | Free-form description of their writing style. This is the most important field. Should include sentence rhythm, tone, verbal tics, humor style, second-person usage patterns. The more specific the better. |
| anti_patterns | text[] | Array of things they would never write (e.g., ["em-dashes", "corporate jargon", "emoji"]) |
| created_at | timestamp, default now() | |
| updated_at | timestamp, default now() | |

#### `writing_samples` table

| Column | Type | Notes |
|---|---|---|
| id | serial, PK | |
| author_id | integer, FK -> authors.id, not null | ON DELETE CASCADE |
| label | text, not null | Short description (e.g., "LinkedIn post about MVCC overhead", "Blog excerpt on partitioning") |
| content | text, not null | The actual writing sample. 200-500 words typical. |
| source_type | text | Where it came from: "linkedin_post", "blog_excerpt", "conference_talk", "slack_message", "other" |
| source_url | text | Optional link to the original |
| created_at | timestamp, default now() | |

### Relationships

- One author has many writing samples
- When an author is deleted, their writing samples cascade delete
- No relationship to the existing content_items table (authors here are voice profiles, not content authors, though they may overlap)

### Migration

Create migration `XXXX_add_author_profiles.sql` following the project's existing migration patterns. Use `tiger_den` schema.

### Drizzle Schema

Add to the existing schema file (or a new schema file if the project splits them). Follow existing patterns for pgSchema usage, relations, etc.

### tRPC Procedures

Add a new `authors` router with these procedures:

**Queries:**
- `authors.list` - return all authors with sample counts. No pagination needed (team will have <50 authors).
- `authors.getByName` - lookup by the `name` slug field. Returns full author record with all writing samples. This is what the MCP tool calls.
- `authors.getById` - lookup by id for the UI edit screens.

**Mutations:**
- `authors.create` - create author profile. Use `contributorProcedure`.
- `authors.update` - update author profile fields. Use `contributorProcedure`.
- `authors.delete` - delete author and cascade samples. Use `contributorProcedure`.
- `authors.addSample` - add a writing sample to an author. Use `contributorProcedure`.
- `authors.updateSample` - edit a writing sample. Use `contributorProcedure`.
- `authors.deleteSample` - remove a writing sample. Use `contributorProcedure`.

### UI

Add an "Authors" section to Tiger Den. Keep it simple. This is an internal tool used by a small team.

**Author list page** (`/authors`):
- Table showing name, title, topics, sample count
- "Add Author" button
- Click row to edit

**Author detail/edit page** (`/authors/[id]`):
- Form for profile fields (display name, title, company, LinkedIn URL, topics, voice notes, anti-patterns)
- Voice notes field should be a large textarea, not a single line input. This is the most important field and will often be 200+ words.
- Below the form: a "Writing Samples" section
- List of existing samples with label, source type, truncated preview
- "Add Sample" button opens a form with label, content (large textarea), source type, source URL
- Edit/delete on each sample
- Anti-patterns as a tag-style input (similar to how tags work on content items if that exists)
- Topics as a tag-style input

No need for anything fancy. Standard CRUD with textareas for the big fields.

### Navigation

Add "Authors" to the sidebar nav, grouped with other settings/config items. Or wherever makes sense given the existing Tiger Den nav structure. Check the current layout before deciding placement.

## Part 2: MCP Server

### Overview

The MCP server lives inside Tiger Den as API routes. No separate deployment. It exposes tools that Claude Code can call during conversations.

The MCP protocol is JSON-RPC over HTTP with Server-Sent Events (SSE) for the transport. For a simple tool-serving MCP server, you need:

- An SSE endpoint for Claude Code to connect to
- Tool definitions (what tools are available)
- Tool execution (handle calls to those tools)

### Recommended Approach

Use the `@modelcontextprotocol/sdk` npm package. It handles the protocol details. You write tool definitions and handlers.

Since Tiger Den is Next.js on Vercel, implement the MCP server as a Next.js API route. The MCP SDK supports a streamable HTTP transport that works with serverless.

### API Route Location

```
src/app/api/mcp/route.ts
```

### Authentication

Keep it simple for an internal tool. API key in a header.

- Add an `MCP_API_KEY` environment variable to Tiger Den
- The MCP route checks for `Authorization: Bearer <key>` on every request
- Return 401 if missing or wrong
- Each team member gets the same key in their Claude Code MCP config

### Tool Definitions

Two tools:

#### Tool 1: `search_content`

**Description:** Search Tiger Den's content library for published content related to a topic. Returns titles, URLs, content types, descriptions, and tags. Use this to find relevant CTAs, internal links, and related content for LinkedIn articles and social posts.

**Input schema:**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query. Can be a topic, keywords, or a natural language question."
    },
    "limit": {
      "type": "number",
      "description": "Max results to return. Default 5.",
      "default": 5
    },
    "content_type": {
      "type": "string",
      "description": "Optional filter by content type (blog_post, case_study, whitepaper, video, etc.)",
    }
  },
  "required": ["query"]
}
```

**Handler:** Call the existing hybrid search (BM25 + semantic with RRF fusion) from Tiger Den. This is the same search the UI uses. Return results as a JSON array of objects with: title, url, content_type, description, tags, publish_date, relevance_score.

**Important:** The search infrastructure already exists in Tiger Den. Don't rebuild it. Find the existing search procedure in the tRPC content router and call the same underlying logic. Check `src/server/api/routers/content.ts` (or wherever the search lives) for the current implementation.

#### Tool 2: `get_author_profile`

**Description:** Retrieve an author's voice profile and writing samples from Tiger Den. Returns their style notes, anti-patterns, topics, and full text of all writing samples. Use this to voice-match content to a specific person.

**Input schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Author's name slug (e.g., 'matty', 'sarah'). Case-insensitive."
    }
  },
  "required": ["name"]
}
```

**Handler:** Call `authors.getByName` (the tRPC procedure from Part 1). Return a JSON object with all profile fields plus the full array of writing samples. Don't truncate the samples. Claude needs the full text to match voice patterns.

**Error case:** If no author is found, return a clear message: "No author profile found for '[name]'. Available authors: [list names]." This lets Claude tell the user who's available and ask for clarification.

### Implementation Notes

- The MCP SDK handles SSE transport, message framing, and tool dispatch. You write the tool definitions and handlers.
- Check the `@modelcontextprotocol/sdk` docs for the server-side setup with Next.js. There are examples for serverless deployment.
- The MCP route does NOT need to be behind NextAuth. It uses its own API key auth. This is a machine-to-machine endpoint, not a user-facing page.
- Keep the tools read-only. No mutations through MCP. Team members manage author profiles through Tiger Den's UI.

### Testing

Before wiring it to Claude Code, test the MCP endpoint directly:
- Use `curl` or the MCP Inspector tool to verify tool listing and execution
- Verify search_content returns sensible results for known queries
- Verify get_author_profile returns full samples, not truncated

## Part 3: Claude Code Skill

### Skill Repository

Create a directory for marketing skills. Could be:
- A new repo: `tiger-data/marketing-skills`
- A directory in an existing repo: `tiger-den/skills/`
- Even just a local directory on each team member's machine

The skill is just a SKILL.md file. Claude Code reads it when referenced.

### Claude Code MCP Configuration

Each team member adds this to their Claude Code MCP config (`.mcp.json` or however their config is set up):

```json
{
  "mcpServers": {
    "tiger-den": {
      "type": "url",
      "url": "https://your-tiger-den-domain.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_API_KEY"
      }
    }
  }
}
```

This could also live in the project's `.mcp.json` if the skill repo is a git repo everyone clones.

### Updated SKILL.md

The skill instructions are the same as the Claude.ai Project version we already wrote, with these changes:

**Author Profiles section** changes to:

> Author profiles are stored in Tiger Den. Use the `get_author_profile` MCP tool to retrieve them.
>
> Call `get_author_profile` with the poster's name before writing anything. The tool returns their voice notes, anti-patterns, topics, and full writing samples.
>
> If the tool returns "no author profile found," tell the user. They can either:
> 1. Paste 2-3 writing samples into the conversation for ad-hoc voice matching (same as before)
> 2. Add the person's profile in Tiger Den at [your Tiger Den URL]/authors and try again
>
> If using ad-hoc samples, after delivering the article, suggest the user add this person to Tiger Den for next time.

**CTA/Link section** gets added:

> **Finding Relevant CTAs and Links**
>
> After writing the article body but before finalizing the social post, call the `search_content` MCP tool with 2-3 queries related to the article's core topics. For example, if the article is about PostgreSQL write amplification, search for "write amplification," "time-series PostgreSQL," and "MVCC overhead."
>
> From the results, select:
> - 1 primary CTA link (whitepaper, free trial, or most relevant deep-dive). This goes in the article's closing and in the social post.
> - 1-2 secondary links (related blog posts, case studies). These go in the social post or are suggested as "first comment" links.
>
> If search returns nothing relevant, fall back to the default CTAs:
> - For conceptual/architectural pieces: link to the architecture whitepaper
> - For hands-on/practical pieces: link to the free trial at https://console.cloud.timescale.com/signup
>
> All links go in the social post or suggested comments. Never in the article body.

**Everything else stays the same.** The anti-patterns list, output spec, quality checklist, iteration protocol. No changes needed.

### Fallback Behavior

The skill should work even without MCP access. If the MCP tools aren't available (someone hasn't configured them, or the server is down), the skill degrades gracefully:

- No author profile tool? Ask for samples to be pasted, same as the original ad-hoc flow.
- No content search tool? Use default CTAs (whitepaper for conceptual, free trial for practical). Skip the link suggestions.

Build this into the skill instructions so Claude doesn't error out or get confused when tools are missing.

## Implementation Order

Recommended sequence for building this out:

### Phase 1: Database and UI (1-2 days)
1. Create the Drizzle schema for `authors` and `writing_samples`
2. Generate and run the migration
3. Create the tRPC `authors` router with all procedures
4. Build the Authors UI pages (list, detail/edit)
5. Manually add 1-2 author profiles with real writing samples for testing

### Phase 2: "Copy to Claude" Button (1-2 days)

The easiest first win. Only depends on Phase 1. No MCP, no Claude Code config, no external dependencies. Once author profiles are in the database, this works immediately.

This gives every team member a zero-setup path to LinkedIn article conversion. No Claude Code, no MCP config, no Project membership. Click a button in Tiger Den or paste/upload unpublished content, copy the prompt, paste into any Claude conversation, get an article back.

#### How It Works

Two entry points, same output:

**Mode 1: From a content item page.** Each content item detail page gets a "Copy for LinkedIn" button (or a dropdown menu item). Clicking it opens a modal. Tiger Den pulls the blog post content from its indexed text automatically.

**Mode 2: Standalone page for unpublished content.** A dedicated page at `/linkedin-converter` (or wherever makes sense in the nav) for content that isn't in Tiger Den yet. This is for drafts, pre-publication reviews, or content from external sources. The page has a large textarea for pasting content AND a file upload that accepts PDFs. For PDF uploads, extract the text client-side using a library like `pdf.js` (or server-side if easier given the existing stack). The extracted text goes into the same prompt template as Mode 1. Add a title field too, since there's no content item to pull it from. Tiger Den uses the pasted/uploaded text for the content search query to find suggested links.

Both modes open the same form with:

1. **Who's posting?** Dropdown of all authors from the authors table.
2. **CTA type:** Dropdown with common options: "Architecture whitepaper," "Free trial," "Related blog post," or a custom freetext field. Each option maps to a URL or lets the user type one.

Optional fields (collapsed by default, for when someone wants more control):
- Target audience (text input, defaults to "infer from content")
- Word count (number input, defaults to 1000)
- Specific angle or emphasis (textarea, for instructions like "lean into cost implications")

When the user clicks "Copy Prompt," Tiger Den assembles a self-contained prompt and copies it to clipboard via `navigator.clipboard.writeText()`. The user pastes it into any Claude interface and gets the four outputs.

#### Implementation Note: Standalone Page

The standalone page is straightforward. It's the same prompt assembly logic as Mode 1, just with a different content source. The form has:

- **Content input** (required, pick one):
  - Textarea for pasting (no character limit, should be a big field)
  - File upload for PDFs. Use `pdfjs-dist` (Mozilla's PDF.js) for client-side text extraction. Show a preview of the extracted text so the user can verify it looks right before generating the prompt. If extraction is messy (scanned PDFs, weird formatting), the user can edit the extracted text in the textarea before proceeding.
- **Title** (required for standalone, since there's no content item): Used for the content search query to find suggested links.
- Everything else identical to Mode 1 (author dropdown, CTA, optional fields).

Add "LinkedIn Converter" to the sidebar nav. The content item button and the standalone page share the same prompt assembly function. Don't duplicate that logic.

#### What Gets Assembled

The prompt is built from a template that stitches together:

1. **Condensed skill instructions** (~800 words). This is a trimmed version of SKILL.md. Keep: output spec (all four deliverables), anti-patterns list in full, structure/length rules, voice matching instructions, linking rules, CTA placement rules, quality checklist. Cut: MCP tool references, fallback behavior, iteration protocol, author profile lookup instructions (the prompt already includes the profile). Store this template as a constant in the codebase or as a text field in a config table if you want to edit it without redeploying.

2. **Author profile.** Full voice notes, anti-patterns array, display name, title, company.

3. **Writing samples.** All samples for the selected author, labeled. Full text, not truncated.

4. **Blog post content.** In Mode 1: the content item's indexed full text from the `content_text` or `content_chunks` tables. If the content hasn't been indexed, fall back to the title + description + URL and add a note: "Full blog post text was not available. Please paste the full content below before submitting this prompt." In Mode 2: the pasted text or extracted PDF text directly.

5. **Suggested links.** Run a content search (the same hybrid search the app already uses) against the blog post's title and first ~200 words. In Mode 1, use the content item's title and tags. In Mode 2, use the title field and the first chunk of pasted/uploaded text. Include the top 3-5 results with titles, URLs, content types, and short descriptions.

6. **Target details.** Poster name, audience, CTA with URL, word count target.

#### Prompt Template Structure

```
You are converting a blog post into a LinkedIn article. Follow these instructions exactly.

## Instructions

[condensed SKILL.md: output spec, anti-patterns, structure rules, voice matching, linking rules, CTA placement, quality checklist]

## Author Voice Profile

Name: [display_name]
Title: [title] at [company]

Voice and style notes:
[voice_notes]

Anti-patterns (never use these in any output):
[anti_patterns, one per line]

## Writing Samples

### Sample 1: [label]
[full sample text]

### Sample 2: [label]
[full sample text]

[...etc]

## Blog Post to Convert

[full blog post text, or title + description + URL with note to paste content]

## Target Details

- Poster: [display_name]
- Audience: [audience or "infer from content"]
- CTA: [cta_type] - [cta_url]
- Word count: [word_count]
[- Specific angle: [angle] (only if provided)]

## Suggested Links for Social Post and Comments

These are related content from our library. Pick the most relevant for CTA links in the social post:
1. [title] ([content_type]) - [url]
   [short description]
2. [title] ([content_type]) - [url]
   [short description]
[...etc, 3-5 items]

---

Produce all four outputs in order: LinkedIn SEO title, LinkedIn SEO description, article body (900-1100 words), social post with hashtags.
```

#### Size Estimate

Typical assembled prompt: 5000-8500 words / 8000-12000 tokens. Well within Claude's context limits on any plan. The blog post content is the biggest variable. Even a 3000-word blog post with 5 writing samples at 500 words each lands around 10000 words total. Not a problem.

#### Implementation Details

**UI component:** Two entry points, shared core logic.

For Mode 1 (content item page): a client component button that opens a modal. The modal fetches the content item's indexed text automatically.

For Mode 2 (standalone page): a full page at `/linkedin-converter` with the textarea/upload input, title field, and the same author/CTA form.

Both call the same prompt assembly function. Extract that into a shared utility (e.g., `src/lib/linkedin-prompt-builder.ts`) that takes content text, title, author profile, CTA config, and optional overrides, and returns the assembled prompt string.

On submit, both modes:

1. Fetch the selected author's full profile and samples via `authors.getByName`
2. Get the content text (Mode 1: from indexed content. Mode 2: from textarea or PDF extraction)
3. Run a content search using the title and content as the query, limit 5
4. Assemble the prompt string from the template
5. Copy to clipboard
6. Show a success toast: "Prompt copied! Paste it into any Claude conversation."

**Prompt template storage:** Store the condensed skill instructions as a constant in a file like `src/lib/linkedin-prompt-template.ts`. This makes it easy to update the instructions without touching the UI code. If you want non-developers to be able to edit the template, store it in the database as a config record instead.

**Fallback for unindexed content (Mode 1 only):** If the content item hasn't been indexed (no full text available), the prompt should still work. Include the title, description, and URL, and prepend a line: "NOTE: The full blog post text could not be retrieved automatically. Please paste the full content of the blog post below this line before submitting this prompt to Claude." Then leave a blank space. The user pastes the blog text into the prompt before submitting. This doesn't apply to Mode 2, where the user provides the text directly.

**No server-side AI calls.** This feature doesn't call the Anthropic API. It just assembles a text prompt. All the AI work happens in whatever Claude interface the user pastes into. Zero API cost on Tiger Den's side.

#### Why This Matters

This is the lowest-friction path for team members who don't use Claude Code. No setup, no config files, no project membership. The button does all the data gathering and prompt assembly that a human would otherwise do manually. And because the prompt includes the full skill instructions, the output quality matches the MCP workflow.

It also means you have three tiers of access to the same capability:

1. **Tiger Den copy button** (anyone with Tiger Den access): One-click prompt, paste anywhere. Available after Phase 2.
2. **Claude Code + MCP** (power users): Live tool calls, iterative workflow, full skill file. Available after Phase 4.
3. **Claude.ai Project** (team members who prefer it): Static files, manual sample management. Available anytime as a parallel option.

All three produce the same four outputs. The difference is just the entry point.

### Phase 3: MCP Server (1 day)

This builds on Phase 1 and gives Claude Code users live access to Tiger Den data during conversations. Not required for the copy button to work, but enables a more fluid workflow for power users.

1. Install `@modelcontextprotocol/sdk`
2. Create the MCP API route at `src/app/api/mcp/route.ts`
3. Implement API key auth
4. Wire up `search_content` to existing hybrid search
5. Wire up `get_author_profile` to the new tRPC procedure
6. Test with curl or MCP Inspector

### Phase 4: Skill and Config (half day)
1. Create the updated SKILL.md with MCP tool references
2. Create the Claude Code MCP config pointing to Tiger Den
3. Test end-to-end: give Claude Code a blog post, ask it to convert for a specific author
4. Iterate on the skill instructions based on output quality

### Phase 5: Team Rollout
1. Walk team through the "Copy to Claude" button (lowest friction, everyone can use this immediately)
2. For Claude Code users: share the MCP config and SKILL.md location
3. Collect feedback, tune author profiles and skill instructions

## Reference: Existing Tiger Den Patterns to Follow

When implementing, match these existing patterns in the codebase:

- **Schema:** Check how existing tables (content_items, campaigns, etc.) are defined with Drizzle and pgSchema. Follow the same pattern for authors/writing_samples.
- **Relations:** Check how content_items_to_campaigns (many-to-many) is defined. The authors-to-samples relationship is simpler (one-to-many) but follow the same relation definition style.
- **tRPC router:** Check how the `content` router is structured. Follow the same patterns for input validation (zod schemas), procedure types (protectedProcedure vs contributorProcedure), and error handling.
- **Search:** Find the existing hybrid search implementation. The MCP `search_content` tool should call the same underlying function, not reimplement search.
- **UI pages:** Check how the content list and content detail pages are built. Follow the same patterns for layouts, forms, and data fetching.
- **Migrations:** Check the existing migration files in the migrations directory. Follow the same naming convention and SQL style.

Do NOT assume file paths or code structure. Always check the actual codebase before implementing. The patterns above are guidance, not prescriptions.

## Reference: Product Context

- The product name is **Tiger Data** (not Tiger Cloud)
- Free trial signup: https://console.cloud.timescale.com/signup
- The MCP API key should be stored as `MCP_API_KEY` in Tiger Den's environment variables
- Tiger Den is deployed on Vercel
- The database is on Tiger Cloud (TimescaleDB)
# Tiger Den: LinkedIn Article Converter Implementation Spec

## Context

This document covers everything needed to extend Tiger Den to support an automated LinkedIn article conversion workflow. The end state: a team member opens Claude Code, says "convert this blog post for Matty's LinkedIn," and Claude Code pulls Matty's voice profile from Tiger Den, writes the article, then queries Tiger Den's content library for relevant CTAs and links. No static files, no copy-pasting, no manual maintenance.

Four pieces need to be built:

1. **Voice profiles and writing samples** in Tiger Den (database tables, CRUD UI, tRPC procedures)
2. **"Copy to Claude" button** in Tiger Den (standalone converter page + content item integration)
3. **External API layer** (REST endpoints + MCP server exposing content search and voice profile retrieval)
4. **Claude Code skill** (a SKILL.md file that references the MCP tools instead of static files)

## Part 1: Voice Profiles in Tiger Den — COMPLETE

> **Status:** Implemented. Key deviations from original plan noted below.

### Database Schema

Two tables in the `tiger_den` schema, following existing Tiger Den patterns (pgSchema(), Drizzle ORM, UUIDs for PKs).

#### `voice_profiles` table

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK, defaultRandom() | UUIDs match existing Tiger Den pattern (not serial as originally planned) |
| name | text, not null, unique | Slug-style lookup key (e.g., "matty", "sarah"). Lowercase, no spaces. |
| display_name | text, not null | Full display name (e.g., "Matty Stratton") |
| title | text | Job title (e.g., "Head of Developer Relations") |
| company | text, default "Tiger Data" | |
| linkedin_url | text | Their LinkedIn profile URL |
| topics | text[] | Array of topics they cover |
| voice_notes | text, not null | Free-form description of their writing style. Most important field. |
| anti_patterns | text[] | Array of things they would never write |
| created_at | timestamp, default now() | |
| updated_at | timestamp, default now() | |

#### `writing_samples` table

| Column | Type | Notes |
|---|---|---|
| id | uuid, PK, defaultRandom() | UUIDs match existing Tiger Den pattern |
| voice_profile_id | uuid, FK -> voice_profiles.id, not null | ON DELETE CASCADE. Column name: `voiceProfileId` in Drizzle. |
| label | text, not null | Short description |
| content | text, not null | The actual writing sample. 200-500 words typical. |
| source_type | text | "linkedin_post", "blog_excerpt", "conference_talk", "slack_message", "other" |
| source_url | text | Optional link to the original |
| created_at | timestamp, default now() | |

### Relationships

- One voice profile has many writing samples
- When a voice profile is deleted, writing samples cascade delete
- No relationship to the existing content_items table (voice profiles are writing style profiles, not content authors, though they may overlap)

### tRPC Router

Router registered as `voiceProfiles` in `src/server/api/root.ts`.

**Queries:**
- `voiceProfiles.list` — all profiles with sample counts. `protectedProcedure`.
- `voiceProfiles.getByName` — lookup by slug. Returns full record with all writing samples. `protectedProcedure`.
- `voiceProfiles.getById` — lookup by UUID for edit screens. `protectedProcedure`.

**Mutations:**
- `voiceProfiles.create` — create profile. `contributorProcedure`.
- `voiceProfiles.update` — update profile fields. `contributorProcedure`.
- `voiceProfiles.delete` — delete profile and cascade samples. `contributorProcedure`.
- `voiceProfiles.addSample` — add writing sample. `contributorProcedure`.
- `voiceProfiles.updateSample` — edit writing sample. `contributorProcedure`.
- `voiceProfiles.deleteSample` — remove writing sample. `contributorProcedure`.

### UI

**Voice profile list page** (`/voice-profiles`):
- Table showing name, title, topics, sample count
- "Add Voice Profile" button
- Click row to edit

**Voice profile detail/edit page** (`/voice-profiles/[id]`):
- Form for profile fields (display name, title, company, LinkedIn URL, topics, voice notes, anti-patterns)
- Voice notes field is a large textarea
- Below the form: "Writing Samples" section with list, add/edit/delete
- Anti-patterns and topics as tag-style inputs

### Navigation

"Voice Profiles" in the sidebar nav.

### Implementation Notes (Lessons Learned)

- **UUIDs for PKs:** Original plan specified serial. Implementation uses `uuid("id").defaultRandom().primaryKey()` to match existing Tiger Den tables.
- **Table/column naming:** `voice_profiles` and `writing_samples` tables. FK column is `voiceProfileId` in Drizzle.
- **Migration:** Don't run migrations against prod during development — let the deploy pipeline handle it.

## Part 2: "Copy to Claude" Button — COMPLETE

> **Status:** Implemented. Key deviations from original plan noted below.

### How It Works

Two entry points, same output:

**Mode 1: From a content item page.** Each content item detail page has a "Convert for LinkedIn" button that opens a modal (`src/app/content/[id]/_components/linkedin-converter-modal.tsx`). Tiger Den pulls the blog post content from its indexed text automatically.

**Mode 2: Standalone page for unpublished content.** A dedicated page at `/linkedin-converter` for content not yet in Tiger Den. Supports pasting text and PDF upload. The page has a large textarea for pasting content AND a file upload that accepts PDFs. PDF text extraction is client-side using `pdfjs-dist`.

Both modes use the same prompt assembly logic via `buildLinkedInPrompt()` from `src/lib/linkedin-prompt-builder.ts`.

### Prompt Assembly

The prompt is built from:

1. **Condensed skill instructions** from `src/lib/linkedin-prompt-template.ts` (exports `LINKEDIN_SKILL_INSTRUCTIONS` constant)
2. **Voice profile** — full voice notes, anti-patterns, display name, title, company
3. **Writing samples** — all samples for selected profile, full text
4. **Blog post content** — indexed text (Mode 1) or pasted/uploaded text (Mode 2)
5. **Suggested links** — hybrid search results for related content
6. **Target details** — poster name, audience, CTA, word count

The `VoiceProfile` type is exported from `src/lib/linkedin-prompt-builder.ts`:

```typescript
interface VoiceProfile {
  displayName: string
  title: string | null
  company: string | null
  voiceNotes: string
  antiPatterns: string[] | null
  topics: string[] | null
  writingSamples: { label: string; content: string }[]
}
```

### Implementation Notes (Lessons Learned)

- **PDF worker:** Must be served from `/public/pdf.worker.min.mjs`. CDN doesn't work for pdfjs-dist v5 — the worker file must be local.
- **Title field:** Optional on the standalone converter. Only used for the content search query to find suggested links.
- **Prompt template:** Stored as a constant in `src/lib/linkedin-prompt-template.ts`, not in the database. Easy to update without touching UI code.
- **No server-side AI calls.** The feature assembles a text prompt. All AI work happens in whatever Claude interface the user pastes into. Zero API cost on Tiger Den's side.

### Three Tiers of Access

1. **Tiger Den copy button** (anyone with Tiger Den access): One-click prompt, paste anywhere. Available now.
2. **Claude Code + MCP** (power users): Live tool calls, iterative workflow, full skill file. Available after Phase 3-4.
3. **Claude.ai Project** (team members who prefer it): Static files, manual sample management. Available anytime as a parallel option.

All three produce the same four outputs. The difference is just the entry point.

## External API Architecture

### Current State

- Business logic lives in `src/server/services/` (search-service.ts, keyword-search.ts, etc.)
- tRPC routers are thin wrappers around services
- No external API access exists today (only tRPC + cron secret)

### Design Decision: Shared Service Layer

Both the REST API and MCP server are thin wrappers over the same service layer. Neither calls the other — they both call services directly.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  tRPC (UI)  │  │  REST API   │  │ MCP Server  │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
              ┌─────────┴─────────┐
              │   Service Layer   │
              │  (search, voice   │
              │   profiles, etc.) │
              └───────────────────┘
```

This means:
- **No logic duplication.** MCP tools and REST endpoints share the same service functions.
- **REST API** is a standard HTTP interface for non-MCP consumers (custom scripts, webhooks, future integrations).
- **MCP server** adds the MCP protocol layer on top for Claude Code, Eon, and any other MCP-capable client.
- **Both use the same API key auth pattern** (shared middleware in `src/server/api-key-auth.ts` or similar).

### Who Uses What

| Consumer | Interface | Notes |
|---|---|---|
| Tiger Den UI | tRPC | Existing, no changes needed |
| Claude Code | MCP server | MCP tools for content search + voice profiles |
| Eon (tiger-eon) | MCP server | Same MCP endpoint, streamable HTTP transport |
| Custom scripts, webhooks | REST API | Standard HTTP for non-MCP consumers |

Eon uses MCP servers natively (see [tiger-eon MCP config](https://github.com/timescale/tiger-eon/blob/main/docs/mcp-config.md)) with streamable HTTP transport, so it connects to the same `/api/mcp` endpoint as Claude Code. No separate integration needed.

### Shared Auth

- `MCP_API_KEY` environment variable (existing plan, no change)
- REST API uses `Authorization: Bearer <key>` header
- MCP server uses the same key validation
- Shared validation function in `src/server/api-key-auth.ts`

## Phase 3a: REST API

Create `src/app/api/v1/` REST endpoints with API key auth.

### Endpoints

| Method | Path | Description | Service Function |
|---|---|---|---|
| GET | `/api/v1/content/search` | Hybrid search | `hybridSearch` from search-service.ts |
| GET | `/api/v1/voice-profiles/:name` | Get voice profile by slug | `voiceProfiles.getByName` query |
| GET | `/api/v1/content` | List/filter content items | Existing content list query |
| GET | `/api/v1/content/:id` | Single content item with metadata | Existing content getById query |

### Implementation

1. Create shared API key auth middleware (`src/server/api-key-auth.ts`)
2. Create REST route handlers in `src/app/api/v1/`
3. Wire to existing service layer — no new business logic
4. Read-only endpoints only (no mutations via REST)
5. Test with curl

## Phase 3b: MCP Server

The MCP server lives inside Tiger Den as an API route. No separate deployment. It exposes tools that Claude Code and Eon can call.

### API Route

```
src/app/api/mcp/route.ts
```

### Setup

Use `@modelcontextprotocol/sdk`. Streamable HTTP transport (works with Vercel serverless and MCP clients like Claude Code and Eon).

### Authentication

Same API key auth as the REST API. Checks `Authorization: Bearer <key>` on every request. Returns 401 if missing or wrong.

### Tool Definitions

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
      "description": "Optional filter by content type (blog_post, case_study, whitepaper, video, etc.)"
    }
  },
  "required": ["query"]
}
```

**Handler:** Calls existing hybrid search (BM25 + semantic with RRF fusion) from the service layer. Returns JSON array with: title, url, content_type, description, tags, publish_date, relevance_score.

#### Tool 2: `get_voice_profile`

**Description:** Retrieve a voice profile and writing samples from Tiger Den. Returns style notes, anti-patterns, topics, and full text of all writing samples. Use this to voice-match content to a specific person.

**Input schema:**
```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Voice profile name slug (e.g., 'matty', 'sarah'). Case-insensitive."
    }
  },
  "required": ["name"]
}
```

**Handler:** Calls `voiceProfiles.getByName` from the service layer. Returns full profile with all writing samples (not truncated — Claude needs full text for voice matching).

**Error case:** If not found, return: "No voice profile found for '[name]'. Available profiles: [list names]."

### Implementation Notes

- MCP route does NOT use NextAuth. It uses API key auth. Machine-to-machine endpoint.
- Keep tools read-only. No mutations through MCP.
- Both REST API and MCP share the same API key validation.

### Eon Configuration

Once the MCP server is deployed, Eon connects via its `mcp_config.json`:

```json
{
  "tiger_den": {
    "tool_prefix": "tiger_den",
    "url": "https://your-tiger-den-domain.vercel.app/api/mcp",
    "env": {
      "AUTHORIZATION": "Bearer YOUR_MCP_API_KEY"
    }
  }
}
```

This gives Eon access to the same `search_content` and `get_voice_profile` tools that Claude Code uses.

### Testing

- Use curl or MCP Inspector to verify tool listing and execution
- Verify `search_content` returns sensible results for known queries
- Verify `get_voice_profile` returns full samples, not truncated

## Phase 4: Skill and Config

### Claude Code MCP Configuration

Each team member adds this to their Claude Code MCP config:

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

### Updated SKILL.md

The skill instructions reference MCP tools instead of static files:

**Voice Profile section:**

> Voice profiles are stored in Tiger Den. Use the `get_voice_profile` MCP tool to retrieve them.
>
> Call `get_voice_profile` with the poster's name before writing anything. The tool returns their voice notes, anti-patterns, topics, and full writing samples.
>
> If the tool returns "no voice profile found," tell the user. They can either:
> 1. Paste 2-3 writing samples into the conversation for ad-hoc voice matching
> 2. Add the person's profile in Tiger Den at [your Tiger Den URL]/voice-profiles and try again
>
> If using ad-hoc samples, after delivering the article, suggest the user add this person to Tiger Den for next time.

**CTA/Link section:**

> After writing the article body but before finalizing the social post, call the `search_content` MCP tool with 2-3 queries related to the article's core topics.
>
> From the results, select:
> - 1 primary CTA link (whitepaper, free trial, or most relevant deep-dive) for the article's closing and social post
> - 1-2 secondary links (related blog posts, case studies) for the social post or suggested "first comment" links
>
> If search returns nothing relevant, fall back to default CTAs:
> - Conceptual/architectural pieces: link to the architecture whitepaper
> - Hands-on/practical pieces: link to the free trial at https://console.cloud.tigerdata.com/signup
>
> All links go in the social post or suggested comments. Never in the article body.

### Fallback Behavior

The skill works without MCP access. If tools aren't available:
- No voice profile tool? Ask for samples to be pasted (ad-hoc flow).
- No content search tool? Use default CTAs. Skip link suggestions.

### Steps

1. Create the updated SKILL.md with MCP tool references
2. Create the Claude Code MCP config pointing to Tiger Den
3. Test end-to-end: give Claude Code a blog post, ask it to convert for a specific voice profile
4. Iterate on skill instructions based on output quality

## Phase 5: Team Rollout

1. Walk team through the "Copy to Claude" button (lowest friction, everyone can use immediately)
2. For Claude Code users: share the MCP config and SKILL.md location
3. For Eon integration: add Tiger Den to Eon's MCP config
4. Collect feedback, tune voice profiles and skill instructions

## Reference: Existing Tiger Den Patterns to Follow

When implementing remaining phases, match these existing patterns:

- **Schema:** Check how existing tables (content_items, campaigns, voice_profiles) are defined with Drizzle and pgSchema. UUIDs for PKs.
- **Relations:** Check how content_items_to_campaigns (many-to-many) and voice_profiles-to-writing_samples (one-to-many) are defined.
- **tRPC router:** Check how the `content` and `voiceProfiles` routers are structured. Follow the same patterns for input validation (zod schemas), procedure types, and error handling.
- **Search:** The existing hybrid search implementation in `src/server/services/search-service.ts`. The MCP `search_content` tool and REST endpoint should call the same underlying function.
- **UI pages:** Check how voice profile list and detail pages are built for reference.

Do NOT assume file paths or code structure. Always check the actual codebase before implementing.

## Reference: Product Context

- The product name is **Tiger Data** (not Tiger Cloud, not Timescale)
- The correct domain is `tigerdata.com` (not `timescale.com`)
- Free trial signup: `https://console.cloud.tigerdata.com/signup` (note: may still redirect from the old `console.cloud.timescale.com` domain — normalize to `tigerdata.com` in all new content)
- The MCP API key should be stored as `MCP_API_KEY` in Tiger Den's environment variables
- Tiger Den is deployed on Vercel
- The database is on Tiger Cloud (TimescaleDB)

## Reference: Key File Locations

| File | Purpose |
|---|---|
| `src/server/db/schema.ts` | Drizzle schema (voice_profiles, writing_samples tables) |
| `src/server/api/routers/voice-profiles.ts` | tRPC router for voice profiles |
| `src/lib/linkedin-prompt-builder.ts` | Prompt assembly function + VoiceProfile type |
| `src/lib/linkedin-prompt-template.ts` | LINKEDIN_SKILL_INSTRUCTIONS constant |
| `src/app/voice-profiles/page.tsx` | Voice profile list page |
| `src/app/voice-profiles/[id]/page.tsx` | Voice profile detail/edit page |
| `src/app/linkedin-converter/page.tsx` | Standalone LinkedIn converter page |
| `src/app/content/[id]/_components/linkedin-converter-modal.tsx` | Content item converter modal |

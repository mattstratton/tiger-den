# Tiger Den - Content Inventory System

## Overview

Content inventory tracking system for marketing. Tracks published content (YouTube videos, blog posts, case studies, website content, third-party content) with metadata including campaigns, authors, publish dates, tags, and descriptions.

## Product Brief

Centralized database for all marketing content inventory. Supports manual entry, CSV import/export, CMS API imports (Ghost, Contentful), YouTube transcript indexing, search and filtering, campaign management, and URL change tracking.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Backend**: tRPC, NextAuth.js v5 with Google OAuth
- **Database**: PostgreSQL (TimescaleDB) with Drizzle ORM
- **State Management**: TanStack Query (React Query) v5
- **Search**: pg_textsearch (BM25), pgvector (embeddings), OpenAI text-embedding-3-small

## Database

- **Schema**: `tiger_den`
- **User**: `tiger_den`
- **Service**: Tiger Cloud (TimescaleDB)
- **Content Indexing Tables**: `content_text`, `content_chunks`

All tables use the `tiger_den` schema via `pgSchema()`.

Always use the Tiger Cloud MCP tools (`mcp__tiger__db_execute_query`) for database operations — do not default to raw shell commands or manual setup. Check available MCP tools before starting any database-related task.

### Extensions Enabled
- `vector` - pgvector for embeddings storage
- `pg_textsearch` - BM25 keyword search
- `pgai` - Available but not yet in use (future: pgai Vectorizer for automated embedding generation)

### Database User Configuration
The `tiger_den` user requires the correct search_path to access pgvector types:
```sql
ALTER ROLE tiger_den SET search_path = tiger_den, public;
```
This is handled automatically by the migration `0003_add_search_path.sql`.

## System Requirements

- **Node.js**: v20 or later

## File Handling

Do not attempt to read large binary files (PDFs, images) directly. If the user references a PDF or large file, ask them to paste relevant excerpts or summarize the content instead.

## Language & Types

This is a TypeScript project. Always use TypeScript (not JavaScript) for new files. Ensure proper types — do not use `any` or leave non-optional fields undefined. Run `tsc --noEmit` to check types after edits.

## Data Pipeline / Import

When implementing import pipelines or data ingestion, always include indexing/embedding generation as part of the import step — never leave it as a separate manual re-index unless explicitly asked.

## Commands

```bash
npm run dev          # Start dev server with Turbo
npm run build        # Production build
npm run typecheck    # Type check
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
npm run db:push      # Push schema changes (dev only)
npm run db:studio    # Open Drizzle Studio
npm run check        # Linter and type checks
```

## General Workflow

When implementing features, start writing code quickly. Limit exploration/planning to at most 2-3 minutes of tool calls before producing implementation code. If you need more context, ask the user rather than exhaustively scanning the codebase.

## Git Workflow

Do NOT use git worktrees. Commit and push directly on the current branch.

## Debugging Guidelines

When debugging, stop after 3 failed attempts at the same approach and reassess the root cause before trying more code changes. Prefer investigating (logs, docs, config) over blindly iterating on code fixes.


## Key Features

### Content Management
- Create, read, update, delete content items
- Track title, URL (with history), content type, publish date, description, author, target audience, tags
- Link content to campaigns (many-to-many)
- Source tracking (manual, csv_import, ghost_api, contentful_api, future: asana_webhook)

### Campaign Management
- Create, read, update, delete campaigns
- Name + description
- View content count per campaign
- Prevent deletion if campaigns have content

### CSV Import/Export
- Import content from CSV with validation
- Auto-create campaigns during import
- Skip invalid rows with error reporting
- Auto-fetch page titles from URLs when title field is blank during import
- Export filtered content to CSV
- Template download

### Search & Filtering
- Three search modes: metadata (title/description/URL/author), keyword (BM25 full-text), full content (hybrid semantic + keyword with RRF fusion)
- Filter by content type, campaign, tag (multi-select combobox), date range
- Author search
- Pagination (50 items per page)

### Authentication
- Google OAuth via NextAuth.js v5
- Domain restriction (GOOGLE_HOSTED_DOMAIN)
- All features require authentication
- Server-side session management with database storage

### Content Indexing & Hybrid Search
- Full-text indexing of web pages and YouTube transcripts
- Hybrid search: BM25 keyword + semantic vector (OpenAI text-embedding-3-small) with RRF fusion
- Leverages Tiger Cloud: pg_textsearch, pgvector (halfvec(1536))
- Sync indexing for ≤10 items (configurable threshold)
- Scheduled imports via Vercel Cron for Ghost, Contentful, and YouTube
- Manual re-index for failed/pending items
- Status tracking: pending, indexed, failed
- Future: migrate to pgai Vectorizer for automated embedding generation

## Key Patterns

### Import Aliases
Use `~/` for imports from `src/`:
```typescript
import { db } from "~/server/db";
import { api } from "~/trpc/server";
```

### Server vs Client Components
- Pages are Server Components by default
- Client components use `"use client"` directive
- Client components in `_components/` directories

### tRPC Procedures
- `protectedProcedure` for read-only operations (require auth)
- `contributorProcedure` for create/update/delete operations (requires contributor or admin role)
- `adminProcedure` for admin-only operations (user management, API imports)
- Key routers: content, campaigns, contentTypes, csv, users, admin

### Database Queries
Use Drizzle ORM:
```typescript
import { db } from "~/server/db";
import { contentItems, campaigns } from "~/server/db/schema";

await db.query.contentItems.findMany({
  with: { campaigns: { with: { campaign: true } } }
});
```

## Future Features

Tracked for future implementation:
- Asana webhook integration (trigger on "published" status)
- CSV field mapping UI
- Type-specific metadata fields (video duration, word count, etc.)
- Bulk editing
- Saved filters
- API endpoints for external systems/AI agents
- Analytics dashboard
- pgai Vectorizer for automated embedding generation (replace manual OpenAI calls)
- Metadata-enriched search chunks (prepend title/tags/type to chunks before embedding — see GitHub issue #4)

## Development Notes

- URL changes automatically tracked (old URL moved to `previousUrls` array)
- Campaigns auto-created during CSV import
- Duplicate URLs prevented across all content
- Soft validation on URL format (basic http/https check)
- Hard deletes (no soft delete/archive in v1)

## Deployment

Target: Vercel
- Set all environment variables in Vercel project settings
- Use Tiger Cloud connection string for DATABASE_URL
- Set AUTH_URL to production domain
- Set AUTH_SECRET using: openssl rand -base64 32

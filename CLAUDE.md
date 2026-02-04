# Tiger Den - Content Inventory System

## Overview

Content inventory tracking system for marketing. Tracks published content (YouTube videos, blog posts, case studies, website content, third-party content) with metadata including campaigns, authors, publish dates, tags, and descriptions.

## Product Brief

Centralized database for all marketing content inventory. Supports manual entry, CSV import/export, search and filtering, campaign management, and URL change tracking. Built for future integration with CMS APIs and Asana webhooks.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Backend**: tRPC, NextAuth.js v5 with Google OAuth
- **Database**: PostgreSQL (TimescaleDB) with Drizzle ORM
- **State Management**: TanStack Query (React Query) v5
- **Search**: pg_textsearch (BM25), pgvector (embeddings), pgai (auto-embedding)

## Database

- **Schema**: `tiger_den`
- **User**: `tiger_den`
- **Service**: Tiger Cloud (TimescaleDB)
- **Content Indexing Tables**: `content_text`, `content_chunks`

All tables use the `tiger_den` schema via `pgSchema()`.

### Extensions Enabled
- `vector` - pgvector for embeddings storage
- `pg_textsearch` - BM25 keyword search
- `pgai` - Automated embedding generation

### Database User Configuration
The `tiger_den` user requires the correct search_path to access pgvector types:
```sql
ALTER ROLE tiger_den SET search_path = tiger_den, public;
```
This is handled automatically by the migration `0003_add_search_path.sql`.

## System Requirements

- **Node.js**: v20 or later
- **yt-dlp**: Required for YouTube transcript extraction
  - Install: `brew install yt-dlp` (macOS) or `pip install yt-dlp` (Python)
  - Used for downloading YouTube video transcripts (manual and auto-generated captions)
  - Fallback: Content items without transcripts will show "Not indexed" status

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

## Key Features

### Content Management
- Create, read, update, delete content items
- Track title, URL (with history), content type, publish date, description, author, target audience, tags
- Link content to campaigns (many-to-many)
- Source tracking (manual, csv_import, future: cms_api, asana_webhook)

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
- Global search (title, description, URL)
- Filter by content type
- Filter by campaign
- Date range filter (future)
- Pagination (50 items per page)

### Authentication
- Google OAuth via NextAuth.js v5
- Domain restriction (GOOGLE_HOSTED_DOMAIN)
- All features require authentication
- Server-side session management with database storage

### Content Indexing & Hybrid Search
- Full-text indexing of web pages and YouTube transcripts
- Hybrid search: BM25 keyword + semantic vector with RRF fusion
- Leverages Tiger Cloud: pg_textsearch, pgvectorscale, pgai Vectorizer
- Sync indexing for ≤10 items (configurable threshold)
- Async queue for bulk imports (Phase 2)
- Manual re-index for failed/pending items
- Status tracking: pending, indexed, failed

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
- All procedures use `protectedProcedure` (require auth)
- Content router: list, getById, create, update, delete
- Campaigns router: list, create, update, delete
- CSV router: import, export

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
- CMS API integration (auto-import on publish)
- Asana webhook integration (trigger on "published" status)
- CSV field mapping UI
- Type-specific metadata fields (video duration, word count, etc.)
- Bulk editing
- Advanced filtering and saved filters
- API endpoints for external systems/AI agents
- Analytics dashboard
- Role-based access control

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

# Tiger Den - Content Inventory System

A modern content inventory tracking system for marketing teams, built with the T3 Stack.

## Overview

Tiger Den helps marketing teams track and manage their published content across multiple channels (YouTube videos, blog posts, case studies, website content, and third-party publications). It provides a centralized database with powerful search, filtering, campaign management, and CSV import/export capabilities.

## Features

- **Content Management** - Create, edit, and delete content items with comprehensive metadata
- **Campaign Tracking** - Organize content by campaigns with many-to-many relationships
- **CSV Import/Export** - Bulk import content from CSV files with validation and auto-campaign creation
- **Hybrid Search** - Three search modes:
  - *Titles/Metadata* - Basic search on title, description, URL
  - *Keywords (Free)* - BM25 full-text search with PostgreSQL native search
  - *Full Content (AI)* - Semantic vector search + BM25 with RRF fusion (requires OpenAI API key)
- **Content Indexing** - Automatic indexing of web pages and YouTube transcripts for searchable full-text content
- **URL History** - Automatically tracks URL changes to maintain historical references
- **Google OAuth** - Secure authentication with optional domain restriction
- **Tiger Data Branding** - Implements official Tiger Data brand guidelines

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router)
- **Language:** TypeScript
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com)
- **Fonts:** [Geist](https://vercel.com/font) (Sans & Mono)
- **Database:** PostgreSQL (TimescaleDB via Tiger Cloud)
- **ORM:** [Drizzle](https://orm.drizzle.team)
- **API:** [tRPC](https://trpc.io)
- **Authentication:** [NextAuth.js v5](https://authjs.dev)
- **State Management:** [TanStack Query (React Query) v5](https://tanstack.com/query)
- **Search:** pg_textsearch (BM25), pgvector (embeddings), OpenAI embeddings API (optional)

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (recommended: [Tiger Cloud](https://www.tigerdata.com))
- Google OAuth credentials (for authentication)
- **OpenAI API key** (optional, for Full Content AI search)
  - Get yours at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd tiger-den
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Update `.env` with your values:

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"

# NextAuth.js
AUTH_SECRET="your-secret-here"  # Generate with: openssl rand -base64 32
AUTH_URL="http://localhost:3000"  # Or your production URL

# Google OAuth (Required)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_HOSTED_DOMAIN="yourcompany.com"  # Optional: restrict to your domain

# Content Indexing Configuration (Optional)
INDEXING_SYNC_THRESHOLD=10       # Max items to index synchronously (default: 10)
INDEXING_TIMEOUT_MS=5000         # Content fetch timeout in ms (default: 5000)
ENABLE_CONTENT_INDEXING=true     # Enable/disable indexing (default: true)

# OpenAI API (Optional - only for Full Content AI search)
OPENAI_API_KEY="sk-..."          # Get from: https://platform.openai.com/api-keys
                                 # If not provided, Keywords (Free) search still works

# Ghost CMS API (Optional - for importing blog posts)
GHOST_API_URL="https://your-ghost-site.com"
GHOST_CONTENT_API_KEY="your-content-api-key"

# Contentful API (Optional - for importing content)
CONTENTFUL_SPACE_ID="your-space-id"
CONTENTFUL_ACCESS_TOKEN="your-access-token"
CONTENTFUL_ENVIRONMENT="master"

# YouTube Data API (Optional - for bulk importing from a channel)
YOUTUBE_API_KEY="your-api-key"   # From Google Cloud Console
YOUTUBE_CHANNEL_ID="UCxxxxxx"    # Channel ID to import from
```

**Generate Auth Secret:**
```bash
openssl rand -base64 32
```

### Environment Variable Details

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `AUTH_SECRET` | Yes* | - | Secret for session encryption (*optional in dev) |
| `AUTH_URL` | No | `http://localhost:3000` | Base URL for auth callbacks |
| `GOOGLE_CLIENT_ID` | Yes | - | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | - | Google OAuth client secret |
| `GOOGLE_HOSTED_DOMAIN` | No | - | Restrict sign-ins to specific domain |
| `INDEXING_SYNC_THRESHOLD` | No | `10` | Max items for synchronous indexing |
| `INDEXING_TIMEOUT_MS` | No | `5000` | Timeout for content fetching (ms) |
| `ENABLE_CONTENT_INDEXING` | No | `true` | Enable content indexing feature |
| `OPENAI_API_KEY` | No | - | OpenAI API key for AI search (~$0.0001/search) |
| `GHOST_API_URL` | No | - | Ghost CMS URL for blog post import |
| `GHOST_CONTENT_API_KEY` | No | - | Ghost Content API key |
| `CONTENTFUL_SPACE_ID` | No | - | Contentful space ID for content import |
| `CONTENTFUL_ACCESS_TOKEN` | No | - | Contentful Content Delivery API token |
| `CONTENTFUL_ENVIRONMENT` | No | - | Contentful environment (e.g. `master`) |
| `YOUTUBE_API_KEY` | No | - | YouTube Data API v3 key for channel import |
| `YOUTUBE_CHANNEL_ID` | No | - | YouTube channel ID to import videos from |

### 4. Set Up Database

The database schema uses a dedicated `tiger_den` schema. If using Tiger Cloud or another PostgreSQL provider, ensure the schema and user are created:

```sql
CREATE SCHEMA IF NOT EXISTS tiger_den;
CREATE USER tiger_den WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON SCHEMA tiger_den TO tiger_den;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA tiger_den TO tiger_den;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA tiger_den TO tiger_den;
ALTER DEFAULT PRIVILEGES IN SCHEMA tiger_den GRANT ALL ON TABLES TO tiger_den;
ALTER DEFAULT PRIVILEGES IN SCHEMA tiger_den GRANT ALL ON SEQUENCES TO tiger_den;
```

### 5. Run Database Migrations

```bash
npm run db:migrate
```

### 6. Start Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-domain.com/api/auth/callback/google`
4. Copy the Client ID and Client Secret to your `.env` file
5. (Optional) Set `GOOGLE_HOSTED_DOMAIN` to restrict sign-ins to a specific Google Workspace domain

## Available Scripts

```bash
npm run dev          # Start development server with Turbo
npm run build        # Create production build
npm run start        # Start production server
npm run typecheck    # Run TypeScript type checking
npm run db:generate  # Generate new migration from schema changes
npm run db:migrate   # Run pending migrations
npm run db:push      # Push schema changes (dev only, skips migrations)
npm run db:studio    # Open Drizzle Studio (database GUI)
npm run check        # Run linter and type checks
```

## Project Structure

```
tiger-den/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── campaigns/       # Campaign management
│   │   ├── content/         # Content management
│   │   └── _components/     # Shared components
│   ├── server/
│   │   ├── api/            # tRPC routers
│   │   ├── auth/           # NextAuth.js configuration
│   │   └── db/             # Database schema and connection
│   ├── styles/             # Global CSS and Tailwind config
│   └── trpc/               # tRPC client setup
├── docs/                   # Project documentation
├── CLAUDE.md              # AI assistant project guide
├── FOLLOW-UP.md           # Future improvements
└── README.md              # This file
```

## Database Schema

The application uses tables in the `tiger_den` schema:

**Core Tables:**
- **content_items** - Published content with metadata (title, URL, description, type, etc.)
- **campaigns** - Marketing campaigns
- **content_campaigns** - Junction table for many-to-many relationships

**Content Indexing Tables:**
- **content_text** - Full-text content extracted from URLs
- **content_chunks** - Chunked content with embeddings for hybrid search

**Authentication Tables:**
- NextAuth.js tables (users, sessions, accounts, verification_tokens)

**Database Extensions:**
- `vector` - pgvector for embeddings storage (halfvec)
- `pg_textsearch` - BM25 keyword search
- `pgai` - Automated embedding generation

## CSV Import Format

Download the CSV template from the app, or use this format:

```csv
title,url,content_type,publish_date,description,author,target_audience,tags,campaigns
"Example Post","https://example.com","blog_post","2024-01-15","Description here","John Doe","Developers","tech,tutorial","Campaign A,Campaign B"
```

**Valid content_type values:**
- `youtube_video`
- `blog_post`
- `case_study`
- `website_content`
- `third_party`
- `other`

## Claude Prompt configuration

To change the prompt used in the "copy prompt for LinkedIn articles" (note, it's not called that), modify `src/lib/linkedin-prompt-template.ts` and redeploy the app.

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Configure environment variables
4. Deploy!

See [CLAUDE.md](./CLAUDE.md) for detailed deployment instructions.

## Development Notes

- URL changes are automatically tracked (old URLs saved to `previousUrls` array)
- Campaigns are auto-created during CSV import if they don't exist
- Duplicate URLs are prevented across all content items
- All mutations require authentication (protected procedures)
- The "Delete All" button is for testing only - will be admin-only in production

## Future Enhancements

See [FOLLOW-UP.md](./FOLLOW-UP.md) for planned improvements:
- CSV import progress indicator
- Flexible date format parsing
- Metadata enrichment (auto-fetch titles from URLs)
- CMS API integration
- Asana webhook integration
- Role-based access control (RBAC)

## Contributing

This is an internal tool for Tiger Data. For questions or issues, contact the development team.

## License

Proprietary - Tiger Data

---

Built with ❤️ using the [T3 Stack](https://create.t3.gg/)

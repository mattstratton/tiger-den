# API Integration for Content Fetching - Design Document

**Date:** 2026-02-06
**Status:** Approved
**Issue:** #14

## Overview

Replace web scraping with API integration for tigerdata.com content to eliminate navigation text pollution and improve content quality. Implement hybrid content fetching that uses Ghost API for blog posts, Contentful API for learn pages and case studies, and falls back to web scraping for other URLs.

## Problem Statement

Current web scraping extracts unwanted navigation, menu, and UI text alongside actual content, resulting in:
- False positive search results matching navigation terms
- Polluted indexed content
- Difficulty identifying actual content boundaries

## Solution

Integrate with Ghost and Contentful APIs to fetch clean, structured content directly from the CMS, while maintaining web scraping as fallback for external content.

## Architecture

### High-Level Components

**Content Source Router**
Determines fetch method based on URL pattern:
- `tigerdata.com/blog/*` → Ghost API
- `tigerdata.com/learn/*` → Contentful API (learnPage content type)
- `tigerdata.com/case-studies/*` → Contentful API (successStoriesCompany content type)
- Everything else → Web scraping (existing)

**API Clients**
Two new service modules:
- `ghost-api-client.ts` - Ghost Content API integration
- `contentful-api-client.ts` - Contentful Delivery API integration

**Content Mappers**
Transform API responses to our schema:
- `ghost-mapper.ts` - Maps Ghost fields to content_items
- `contentful-mapper.ts` - Maps Contentful fields (handles multiple content types)

**Import Service**
Orchestrates bulk imports:
- `api-import-service.ts` - Chunked imports, progress tracking, matching logic

### Database Changes

**New fields in `content_items` table:**
- `lastModifiedAt` - Timestamp when content was last modified in CMS
- `ghostId` - Ghost post ID (nullable)
- `contentfulId` - Contentful entry ID (nullable)

**New source enum values:**
- `ghost_api`
- `contentful_api`

**New tracking table:**
```sql
CREATE TABLE tiger_den.api_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  total_items INTEGER NOT NULL,
  created_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_details JSONB,
  dry_run BOOLEAN DEFAULT false,
  initiated_by_user_id TEXT REFERENCES tiger_den.users(id)
);
```

## Content Mapping

### Ghost API → Blog Posts

**Ghost provides:**
- `id`, `title`, `slug`, `published_at`, `updated_at`
- `plaintext`, `excerpt` or `custom_excerpt`
- `primary_author.name`, `tags`

**Mapping:**
- `id` → `ghostId`
- `title` → `title`
- `slug` → construct `https://www.tigerdata.com/blog/{slug}` → `current_url`
- `plaintext` → indexed content
- `excerpt` or `custom_excerpt` → `description`
- `primary_author.name` → `author`
- `tags` (array) → `tags`
- `published_at` → `publishDate`
- `updated_at` → `lastModifiedAt`
- Source: `ghost_api`

### Contentful API → Learn Pages

**Content Type:** `learnPage`

**Contentful provides:**
- `sys.id`, `fields.Title`, `fields.Url`, `fields.Content`
- `fields.MetaTitle`, `fields.MetaDescription`, `fields.Section`
- `sys.publishedAt`, `sys.updatedAt`

**Mapping:**
- `sys.id` → `contentfulId`
- `fields.Title` → `title`
- `fields.Url` → `current_url`
- `fields.Content` → indexed content
- `fields.MetaDescription` → `description` (or excerpt from Content if null)
- `fields.Section` → `tags` array
- `sys.publishedAt` → `publishDate`
- `sys.updatedAt` → `lastModifiedAt`
- `author` → null (not provided)
- Source: `contentful_api`

### Contentful API → Case Studies

**Content Type:** `successStoriesCompany`

**Contentful provides:**
- `sys.id`, `fields.name`, `fields.slug`, `fields.externalLink`
- `fields.content` (RichText), `fields.overview`, `fields.category`
- `fields.metaTitle`, `fields.metaDescription`
- `sys.publishedAt`, `sys.updatedAt`

**URL Construction:**
- If `fields.externalLink` populated → use that URL
- Otherwise → `https://www.tigerdata.com/case-studies/{fields.slug}`

**Mapping:**
- `sys.id` → `contentfulId`
- `fields.name` → `title`
- URL construction above → `current_url`
- `fields.content` (extract plain text from RichText) → indexed content
- `fields.metaDescription` OR `fields.overview` → `description`
- `fields.category` → `tags` array
- `sys.publishedAt` → `publishDate`
- `sys.updatedAt` → `lastModifiedAt`
- `author` → null (not provided)
- Source: `contentful_api`

## Matching & Update Logic

### Item Matching Algorithm

For each API item:
1. **Check stored API ID** (ghostId or contentfulId)
   - If match found → known item, proceed to update check
2. **If no API ID, check URL**
   - If URL match found → migration case (scraped → API)
   - Store API ID for future syncs
   - Proceed to update check
3. **If neither match → new content**
   - Create new record with API ID stored

### Update Decision Logic

For existing items:
1. **Check source field:**
   - `ghost_api` or `contentful_api` → Safe to update
   - `manual` or `csv_import` → Skip with warning
   - Mismatched source → Requires confirmation (optional)

2. **Check lastModifiedAt timestamp:**
   - If `API updatedAt <= our lastModifiedAt` → Skip (no changes)
   - If `API updatedAt > our lastModifiedAt` → Update needed

3. **Track changes:**
   - Log: "Updated {title}: changed fields: description, tags"

### Special Cases

- **Case studies with externalLink:** URL may be outside tigerdata.com
- **Learn page URL changes:** Update `current_url`, move old URL to `previousUrls` array
- **Missing required fields:** Log warning, skip item

## Testing & Safety Features

### Built-in Testing Capabilities

1. **Dry-run mode**
   - Preview what would happen without database writes
   - Shows field-by-field diffs
   - Displays which items would be created/updated

2. **Single-item testing**
   - UI for testing one URL or API ID at a time
   - Shows raw API response, mapped fields, existing record
   - "Test Fetch" vs "Actually Import" buttons

3. **Batch size controls**
   - Default: 10 items, max: 100
   - Start with 1-5 items for initial testing
   - Progress tracking item-by-item

4. **Source filtering**
   - Won't overwrite manual/CSV content
   - Warning if trying to update non-API content
   - Confirmation required if source would change

5. **Rollback capability**
   - Import logs track all operations
   - Import history shows what was imported when
   - Aids debugging and verification

### Testing Workflow

1. Test single item in UI (dry-run)
2. Actually import that single item
3. Verify correct in database
4. Try batch of 5-10 items (dry-run)
5. Review results carefully
6. Run actual import on small batch
7. Verify in content list
8. Run larger batches once confident

## Rate Limiting & Error Handling

### Chunked Processing Strategy

**Process flow:**
1. Fetch items in chunks (default: 50)
2. For each chunk:
   - Process each item: map, match, update/create
   - Delay between items: 100ms
3. Delay between chunks: 2 seconds
4. Track progress: "Processing chunk 2/5 (items 51-100)"
5. Log successes/failures per chunk

### Error Handling

- **Network errors:** Retry 3 times with exponential backoff
- **Rate limit errors (429):** Pause 60s, then retry
- **Missing fields:** Log warning, use defaults, continue
- **Invalid data:** Log error, skip item, continue with next

## User Interface

### Admin Page: `/admin/api-import`

**1. API Status Section**
```
Ghost API: ✅ Connected (last tested: 2 min ago)
Contentful API: ✅ Connected (last tested: 2 min ago)
[Test Connections]
```

**2. Single Item Tester**
```
URL or ID: [____________________________]
Source: [▼ Auto-detect | Ghost | Contentful Learn | Contentful Case Study]

[Test Fetch (Dry Run)]  [Actually Import]

Results:
- Raw API response (collapsible)
- Mapped fields preview
- Existing record (if found)
- What would change (diff)
```

**3. Bulk Import with Preview**
```
Import from: [▼ Ghost Blog Posts | Contentful Learn | Contentful Case Studies]

Options:
[x] Only items updated in last: [30] days

[Fetch List from API]

↓ Preview Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Found 127 items from Ghost API

Summary:
- 45 would be CREATED (new)
- 68 would be UPDATED (changed)
- 14 would be SKIPPED (no changes)

Sample items (first 10):
[Table showing Title, Status, Last Modified]

[View Full List] [Export Preview]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[✓ Looks good, proceed]

Batch size: [50] items
[ ] Dry run only

[Start Import]

Progress: ████████░░ 45/100 items (3 failed)
```

**4. Import History**
```
| Date       | Source          | Items | Success | Failed | Duration |
|------------|-----------------|-------|---------|--------|----------|
| 2026-02-06 | Ghost           | 50    | 48      | 2      | 2m 15s   |
| 2026-02-05 | Contentful Learn| 25    | 25      | 0      | 1m 30s   |
```

## Configuration

### Environment Variables

```bash
# Ghost API
GHOST_API_URL=https://blog.tigerdata.com
GHOST_CONTENT_API_KEY=<your_key>

# Contentful API
CONTENTFUL_SPACE_ID=npizagvkn99r
CONTENTFUL_ACCESS_TOKEN=<your_token>
CONTENTFUL_ENVIRONMENT=master

# Import Settings (optional)
API_IMPORT_BATCH_SIZE=50
API_IMPORT_DELAY_MS=100
API_IMPORT_CHUNK_DELAY_MS=2000
```

### Configuration Module

```typescript
// src/server/config/api-config.ts
export const apiConfig = {
  ghost: {
    apiUrl: env.GHOST_API_URL,
    contentApiKey: env.GHOST_CONTENT_API_KEY,
    enabled: !!env.GHOST_API_URL && !!env.GHOST_CONTENT_API_KEY,
  },
  contentful: {
    spaceId: env.CONTENTFUL_SPACE_ID,
    accessToken: env.CONTENTFUL_ACCESS_TOKEN,
    environment: env.CONTENTFUL_ENVIRONMENT ?? "master",
    enabled: !!env.CONTENTFUL_SPACE_ID && !!env.CONTENTFUL_ACCESS_TOKEN,
  },
  import: {
    batchSize: parseInt(env.API_IMPORT_BATCH_SIZE ?? "50"),
    delayMs: parseInt(env.API_IMPORT_DELAY_MS ?? "100"),
    chunkDelayMs: parseInt(env.API_IMPORT_CHUNK_DELAY_MS ?? "2000"),
  },
};
```

### Getting API Credentials

**Ghost:**
1. Go to Ghost Admin → Integrations
2. Create "Custom Integration"
3. Copy Content API Key

**Contentful:**
1. Go to Settings → API Keys
2. Create new key or use existing
3. Copy Space ID and Content Delivery API token

## Implementation Phases

### Phase 1: Foundation (Core Infrastructure)
- Add database schema changes (migration)
- Create API client services (Ghost + Contentful)
- Create field mapper services
- Add configuration and env validation
- **Test:** Connect to APIs and fetch single items

### Phase 2: Matching & Update Logic
- Implement hybrid matching (API ID → URL)
- Implement source-based update logic
- Add lastModifiedAt comparison
- **Test:** Correctly identify existing vs new items

### Phase 3: Single Item Import
- Build single item import service
- Create test endpoint/UI for single imports
- Add dry-run capability
- **Test:** Import one item successfully, verify in database

### Phase 4: Bulk Import
- Implement chunked bulk import service
- Add preview/fetch list functionality
- Add progress tracking
- Create import logs table
- **Test:** Preview lists from API, import small batch

### Phase 5: Admin UI
- Build `/admin/api-import` page
- Add connection status checks
- Add single item tester UI
- Add bulk import UI with preview
- Add import history viewer
- **Test:** Full workflow through UI

### Phase 6: Scheduling (Future)
- Add optional scheduled imports via pg-boss
- Add webhook endpoints (if needed)

## Recommended Implementation Order

1. Start with **Phase 1-3** to get single item working end-to-end
2. Then **Phase 4-5** for bulk imports and full UI
3. **Phase 6** can be added later based on needs

## Success Criteria

- Can import single items from all three sources (Ghost, Contentful learn, Contentful case studies)
- Clean content without navigation text
- Correctly matches existing items and updates them
- Respects manual/CSV content (doesn't overwrite)
- Bulk import handles 100+ items reliably
- Clear visibility into what's happening (preview, progress, logs)
- Safe testing with dry-run mode

## Future Enhancements

- Scheduled automatic syncs (daily/weekly)
- Webhook endpoints for real-time updates
- More granular field-level update controls
- Bulk re-indexing of API content
- Support for draft content preview

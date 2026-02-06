-- Add fields for API integration tracking
ALTER TABLE tiger_den.content_items
  ADD COLUMN last_modified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN ghost_id TEXT,
  ADD COLUMN contentful_id TEXT;

-- Add indexes for API ID lookups
CREATE INDEX content_items_ghost_id_idx
  ON tiger_den.content_items(ghost_id)
  WHERE ghost_id IS NOT NULL;

CREATE INDEX content_items_contentful_id_idx
  ON tiger_den.content_items(contentful_id)
  WHERE contentful_id IS NOT NULL;

CREATE INDEX content_items_last_modified_at_idx
  ON tiger_den.content_items(last_modified_at);

-- Add new source types for API imports
ALTER TYPE tiger_den.source ADD VALUE IF NOT EXISTS 'ghost_api';
ALTER TYPE tiger_den.source ADD VALUE IF NOT EXISTS 'contentful_api';

-- Create API import logs table for tracking import history
CREATE TABLE tiger_den.api_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL, -- 'ghost', 'contentful_learn', 'contentful_case_study'
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
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

-- Add index for querying import history
CREATE INDEX api_import_logs_started_at_idx
  ON tiger_den.api_import_logs(started_at DESC);

CREATE INDEX api_import_logs_source_type_idx
  ON tiger_den.api_import_logs(source_type);

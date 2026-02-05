-- Migration: Add RBAC (user roles) and configurable content types
-- Issues: #6 (Configurable Content Types), #9 (Basic RBAC)

-- Create user_role enum
CREATE TYPE tiger_den.user_role AS ENUM ('admin', 'contributor', 'reader');

-- Add role column to users table
ALTER TABLE tiger_den.users ADD COLUMN role tiger_den.user_role NOT NULL DEFAULT 'reader';

-- Create content_types table
CREATE TABLE tiger_den.content_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(20) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX content_types_display_order_idx ON tiger_den.content_types(display_order);

-- Seed initial content types from existing enum values
INSERT INTO tiger_den.content_types (name, slug, color, display_order, is_system) VALUES
  ('YouTube Video', 'youtube_video', 'red', 0, false),
  ('Blog Post', 'blog_post', 'blue', 1, false),
  ('Case Study', 'case_study', 'green', 2, false),
  ('Website Content', 'website_content', 'purple', 3, false),
  ('Third Party', 'third_party', 'yellow', 4, false),
  ('Other', 'other', 'gray', 5, true);

-- Add content_type_id column to content_items (nullable during migration)
ALTER TABLE tiger_den.content_items ADD COLUMN content_type_id INTEGER REFERENCES tiger_den.content_types(id);

-- Migrate existing enum values to content_type_id
UPDATE tiger_den.content_items
SET content_type_id = (
  SELECT id FROM tiger_den.content_types
  WHERE slug = content_items.content_type::text
);

-- Make content_type_id NOT NULL after migration
ALTER TABLE tiger_den.content_items ALTER COLUMN content_type_id SET NOT NULL;

-- Add index on content_type_id
CREATE INDEX content_items_content_type_id_idx ON tiger_den.content_items(content_type_id);

-- Drop old content_type enum column
ALTER TABLE tiger_den.content_items DROP COLUMN content_type;

-- Drop old enum type
DROP TYPE tiger_den.content_type;

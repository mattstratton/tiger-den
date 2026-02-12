-- Author voice profiles for LinkedIn article conversion
CREATE TABLE tiger_den.authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  title TEXT,
  company TEXT DEFAULT 'Tiger Data',
  linkedin_url TEXT,
  topics TEXT[],
  voice_notes TEXT NOT NULL,
  anti_patterns TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX authors_name_idx ON tiger_den.authors (name);

-- Writing samples for author voice matching
CREATE TABLE tiger_den.writing_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES tiger_den.authors(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX writing_samples_author_id_idx ON tiger_den.writing_samples (author_id);

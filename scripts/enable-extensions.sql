-- Enable Tiger Cloud extensions for content indexing
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_textsearch;
CREATE EXTENSION IF NOT EXISTS pgai CASCADE;

-- Verify extensions
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('vector', 'pg_textsearch', 'pgai')
ORDER BY extname;

-- Enable pg_textsearch extension for BM25
CREATE EXTENSION IF NOT EXISTS pg_textsearch;

-- BM25 keyword search index (pg_textsearch)
CREATE INDEX IF NOT EXISTS content_chunks_bm25_idx
ON tiger_den.content_chunks
USING bm25(chunk_text)
WITH (text_config='english');

-- HNSW vector similarity search index (pgvector)
CREATE INDEX IF NOT EXISTS content_chunks_embedding_idx
ON tiger_den.content_chunks
USING hnsw (embedding halfvec_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Verify indexes created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'content_chunks'
  AND schemaname = 'tiger_den'
ORDER BY indexname;

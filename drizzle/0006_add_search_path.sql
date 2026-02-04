-- Migration: Add search_path for tiger_den user to access pgvector types
-- This allows the tiger_den user to access types (halfvec, vector) defined in the public schema
-- Required for hybrid search functionality with pgvector embeddings

ALTER ROLE tiger_den SET search_path = tiger_den, public;

-- Rename authors to voice_profiles
ALTER TABLE tiger_den.authors RENAME TO voice_profiles;
ALTER INDEX authors_name_idx RENAME TO voice_profiles_name_idx;

-- Rename FK column in writing_samples
ALTER TABLE tiger_den.writing_samples RENAME COLUMN author_id TO voice_profile_id;
ALTER INDEX writing_samples_author_id_idx RENAME TO writing_samples_voice_profile_id_idx;

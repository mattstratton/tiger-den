CREATE TABLE tiger_den.api_import_schedules (
  source_type TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  cron_expression TEXT NOT NULL DEFAULT '0 6 * * *',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tiger_den.api_import_schedules (source_type) VALUES
  ('ghost'), ('contentful_learn'), ('contentful_case_study'), ('youtube_channel');

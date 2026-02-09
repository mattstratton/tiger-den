-- Add youtube_api to source enum
ALTER TYPE "tiger_den"."source" ADD VALUE 'youtube_api';

-- Add youtube_video_id column to content_items
ALTER TABLE "tiger_den"."content_items" ADD COLUMN "youtube_video_id" text;

-- Add index on youtube_video_id
CREATE INDEX "content_items_youtube_video_id_idx" ON "tiger_den"."content_items" USING btree ("youtube_video_id");

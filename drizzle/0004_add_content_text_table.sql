-- Add index_status enum
CREATE TYPE "tiger_den"."index_status" AS ENUM('pending', 'indexed', 'failed');

-- Create content_text table
CREATE TABLE "tiger_den"."content_text" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_item_id" uuid NOT NULL UNIQUE,
	"full_text" text NOT NULL,
	"plain_text" text NOT NULL,
	"word_count" integer NOT NULL,
	"token_count" integer NOT NULL,
	"content_hash" text NOT NULL,
	"crawled_at" timestamp DEFAULT now() NOT NULL,
	"crawl_duration_ms" integer,
	"index_status" "tiger_den"."index_status" DEFAULT 'pending' NOT NULL,
	"index_error" text,
	"indexed_at" timestamp,
	CONSTRAINT "content_text_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "tiger_den"."content_items"("id") ON DELETE cascade
);

-- Create indexes
CREATE INDEX "content_text_item_idx" ON "tiger_den"."content_text" USING btree ("content_item_id");
CREATE INDEX "content_text_status_idx" ON "tiger_den"."content_text" USING btree ("index_status");

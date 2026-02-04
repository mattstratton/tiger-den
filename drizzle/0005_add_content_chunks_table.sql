-- Create content_chunks table
CREATE TABLE "tiger_den"."content_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_text_id" uuid NOT NULL,
	"chunk_text" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"chunk_token_count" integer NOT NULL,
	"embedding" halfvec(1536),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_chunks_content_text_id_fkey" FOREIGN KEY ("content_text_id") REFERENCES "tiger_den"."content_text"("id") ON DELETE cascade
);

-- Create indexes
CREATE INDEX "content_chunks_unique_idx" ON "tiger_den"."content_chunks" USING btree ("content_text_id", "chunk_index");
CREATE INDEX "content_chunks_text_id_idx" ON "tiger_den"."content_chunks" USING btree ("content_text_id");

CREATE TYPE "tiger_den"."content_type" AS ENUM('youtube_video', 'blog_post', 'case_study', 'website_content', 'third_party', 'other');--> statement-breakpoint
CREATE TYPE "tiger_den"."source" AS ENUM('manual', 'csv_import', 'cms_api', 'asana_webhook');--> statement-breakpoint
ALTER TABLE "tiger_den"."content_items" ALTER COLUMN "created_by_user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tiger_den"."content_items" ADD CONSTRAINT "content_items_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "tiger_den"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."content_type";--> statement-breakpoint
DROP TYPE "public"."source";
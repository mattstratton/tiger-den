-- Fix accounts.expires_at to use integer instead of timestamp (NextAuth requirement)
-- Add unique constraint to users.email

-- Change expires_at from timestamp to integer
ALTER TABLE "tiger_den"."accounts" ALTER COLUMN "expires_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tiger_den"."accounts" ALTER COLUMN "expires_at" TYPE integer USING CASE WHEN "expires_at" IS NULL THEN NULL ELSE EXTRACT(EPOCH FROM "expires_at")::integer END;--> statement-breakpoint

-- Add unique constraint to users.email
ALTER TABLE "tiger_den"."users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");--> statement-breakpoint

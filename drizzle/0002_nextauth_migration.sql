-- Migration: Replace Better Auth tables with NextAuth.js compatible tables
-- Drop old Better Auth tables
DROP TABLE IF EXISTS "tiger_den"."verification" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "tiger_den"."session" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "tiger_den"."account" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "tiger_den"."user" CASCADE;--> statement-breakpoint

-- Create users table for NextAuth
CREATE TABLE IF NOT EXISTS "tiger_den"."users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "email" text NOT NULL,
  "emailVerified" timestamp,
  "image" text,
  "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint

-- Create accounts table for NextAuth
CREATE TABLE IF NOT EXISTS "tiger_den"."accounts" (
  "userId" text NOT NULL,
  "type" text NOT NULL,
  "provider" text NOT NULL,
  "providerAccountId" text NOT NULL,
  "refresh_token" text,
  "access_token" text,
  "expires_at" timestamp,
  "token_type" text,
  "scope" text,
  "id_token" text,
  "session_state" text,
  "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);--> statement-breakpoint

-- Create sessions table for NextAuth
CREATE TABLE IF NOT EXISTS "tiger_den"."sessions" (
  "sessionToken" text PRIMARY KEY NOT NULL,
  "userId" text NOT NULL,
  "expires" timestamp NOT NULL,
  "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint

-- Add foreign key constraints
ALTER TABLE "tiger_den"."accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "tiger_den"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiger_den"."sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "tiger_den"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Update foreign keys in existing tables
ALTER TABLE "tiger_den"."content_items" DROP CONSTRAINT IF EXISTS "content_items_created_by_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "tiger_den"."content_items" ADD CONSTRAINT "content_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "tiger_den"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "tiger_den"."post" DROP CONSTRAINT IF EXISTS "post_created_by_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "tiger_den"."post" ADD CONSTRAINT "post_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "tiger_den"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

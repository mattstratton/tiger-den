# NextAuth.js Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate authentication from Better Auth to NextAuth.js (Auth.js v5) to resolve persistent OAuth state management issues on Vercel.

**Architecture:** Replace Better Auth with NextAuth.js using Drizzle adapter for PostgreSQL. Keep existing database schema compatible (users, sessions, accounts tables already exist from Better Auth). Update tRPC context, API routes, and server-side session handling. No client-side auth hooks needed - server-only auth.

**Tech Stack:** NextAuth.js v5, @auth/drizzle-adapter, Drizzle ORM, PostgreSQL/TimescaleDB

---

## Task 1: Install NextAuth.js Dependencies

**Files:**
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/package.json`

**Step 1: Uninstall Better Auth packages**

Run: `npm uninstall better-auth`
Expected: Better Auth removed from package.json and node_modules

**Step 2: Install NextAuth.js and adapter**

Run: `npm install next-auth@beta @auth/drizzle-adapter`
Expected: Packages installed successfully

Note: Using `next-auth@beta` to get v5 (latest stable)

**Step 3: Verify installation**

Run: `npm list next-auth @auth/drizzle-adapter`
Expected: Both packages listed with versions

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install NextAuth.js v5 and Drizzle adapter

Remove Better Auth in favor of NextAuth.js for more stable OAuth support on Vercel.
"
```

---

## Task 2: Update Database Schema for NextAuth

**Files:**
- Read: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/server/db/schema.ts`
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/server/db/schema.ts`

**Step 1: Check existing auth tables**

Better Auth already created these tables:
- `user` (id, name, email, emailVerified, image, createdAt, updatedAt)
- `session` (id, userId, expiresAt, token, ipAddress, userAgent, createdAt, updatedAt)
- `account` (id, userId, accountId, providerId, accessToken, refreshToken, expiresAt, createdAt, updatedAt)

**Step 2: Update schema to match NextAuth requirements**

NextAuth v5 with Drizzle adapter expects:
- `users` table (not `user`)
- `accounts` table (not `account`)
- `sessions` table (not `session`)
- `verificationTokens` table (optional, not needed for OAuth-only)

Replace the Better Auth tables with NextAuth-compatible schema:

```typescript
import { pgSchema, pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const tigerDenSchema = pgSchema("tiger_den");

// NextAuth.js Tables
export const users = tigerDenSchema.table("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const accounts = tigerDenSchema.table("accounts", {
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: timestamp("expires_at", { mode: "date" }),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
}, (account) => ({
  compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
}));

export const sessions = tigerDenSchema.table("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// Existing application tables (contentItems, campaigns, etc.) remain unchanged below...
```

Note: Keep all existing contentItems, campaigns, contentItemCampaigns tables - only replace auth tables.

**Step 3: Generate migration**

Run: `npm run db:generate`
Expected: New migration file created in `drizzle/` directory

**Step 4: Review migration SQL**

The migration should:
- Drop old `user`, `session`, `account` tables
- Create new `users`, `sessions`, `accounts` tables with NextAuth schema
- Preserve all data if possible (though this is a fresh OAuth setup, so data loss acceptable)

**Step 5: Run migration**

Run: `npm run db:migrate`
Expected: Migration applied successfully to tiger_den schema

**Step 6: Verify tables**

Use Tiger MCP tool or Drizzle Studio:
```typescript
// Verify tables exist with correct schema
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'tiger_den'
AND table_name IN ('users', 'accounts', 'sessions');
```

Expected: All three tables exist

**Step 7: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat: update database schema for NextAuth.js

Replace Better Auth tables (user, session, account) with NextAuth-compatible tables (users, sessions, accounts).
"
```

---

## Task 3: Create NextAuth Configuration

**Files:**
- Create: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/server/auth/config.ts`
- Create: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/server/auth/index.ts`

**Step 1: Create NextAuth config with Google provider**

```typescript
// src/server/auth/config.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";

import { env } from "~/env";
import { db } from "~/server/db";
import { users, accounts, sessions } from "~/server/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Domain restriction for Google Workspace
      authorization: {
        params: {
          ...(env.GOOGLE_HOSTED_DOMAIN && {
            hd: env.GOOGLE_HOSTED_DOMAIN,
          }),
        },
      },
    }),
  ],
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnProtectedRoute =
        nextUrl.pathname.startsWith("/content") ||
        nextUrl.pathname.startsWith("/campaigns");

      if (isOnProtectedRoute && !isLoggedIn) {
        return false;
      }
      return true;
    },
  },
});
```

**Step 2: Create index file for exports**

```typescript
// src/server/auth/index.ts
export { auth, signIn, signOut } from "./config";
```

**Step 3: Commit**

```bash
git add src/server/auth/
git commit -m "feat: create NextAuth.js configuration

Set up NextAuth with Google OAuth provider, Drizzle adapter, and domain restriction support.
"
```

---

## Task 4: Create NextAuth API Route

**Files:**
- Delete: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/app/api/auth/[...all]/route.ts`
- Create: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/app/api/auth/[...nextauth]/route.ts`

**Step 1: Delete Better Auth route**

Run: `rm -rf /Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/app/api/auth`
Expected: Old auth directory removed

**Step 2: Create NextAuth route directory**

Run: `mkdir -p /Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/app/api/auth/[...nextauth]`
Expected: Directory created

**Step 3: Create NextAuth route handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "~/server/auth";

export const { GET, POST } = handlers;
```

**Step 4: Commit**

```bash
git add src/app/api/auth/
git commit -m "feat: create NextAuth API route

Replace Better Auth [...all] route with NextAuth [...nextauth] route.
"
```

---

## Task 5: Update tRPC Context for NextAuth

**Files:**
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/server/api/trpc.ts:29-38`

**Step 1: Replace Better Auth imports with NextAuth**

Change:
```typescript
import { auth } from "~/server/better-auth";
```

To:
```typescript
import { auth } from "~/server/auth";
```

**Step 2: Update session retrieval in createTRPCContext**

Change:
```typescript
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth.api.getSession({
    headers: opts.headers,
  });
  return {
    db,
    session,
    ...opts,
  };
};
```

To:
```typescript
export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();
  return {
    db,
    session,
    ...opts,
  };
};
```

**Step 3: Update protectedProcedure middleware**

The session structure is the same, but verify the type:

```typescript
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        // infers the `session` as non-nullable
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });
```

**Step 4: Commit**

```bash
git add src/server/api/trpc.ts
git commit -m "feat: update tRPC context for NextAuth

Replace Better Auth session handling with NextAuth in tRPC context.
"
```

---

## Task 6: Update Home Page Authentication

**Files:**
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/app/page.tsx`

**Step 1: Replace Better Auth imports with NextAuth**

Change:
```typescript
import { auth } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";
```

To:
```typescript
import { auth, signIn } from "~/server/auth";
```

**Step 2: Update session retrieval**

Change:
```typescript
const session = await getSession();
```

To:
```typescript
const session = await auth();
```

**Step 3: Update sign-in action**

Replace the Better Auth sign-in:
```typescript
const res = await auth.api.signInSocial({
  provider: "google",
  callbackURL: "/content",
});
if (!res.url) {
  throw new Error("No URL returned from signInSocial");
}
window.location.href = res.url;
```

With NextAuth server action:
```typescript
"use server";
async function handleSignIn() {
  "use server";
  await signIn("google", { redirectTo: "/content" });
}
```

Update button to use the server action:
```typescript
<form action={handleSignIn}>
  <Button type="submit" size="lg" className="w-full sm:w-auto">
    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
      {/* Google icon SVG */}
    </svg>
    Sign in with Google
  </Button>
</form>
```

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: update home page for NextAuth sign-in

Replace Better Auth client-side OAuth with NextAuth server action.
"
```

---

## Task 7: Update Environment Variables

**Files:**
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/env.js`
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/.env`
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/.env.example`

**Step 1: Update env.js schema**

Replace Better Auth env vars:
```typescript
server: {
  BETTER_AUTH_SECRET:
    process.env.NODE_ENV === "production" ? z.string() : z.string().optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_HOSTED_DOMAIN: z.string().optional(),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
},
```

With NextAuth env vars:
```typescript
server: {
  AUTH_SECRET:
    process.env.NODE_ENV === "production" ? z.string() : z.string().optional(),
  AUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_HOSTED_DOMAIN: z.string().optional(),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
},
```

And update runtimeEnv:
```typescript
runtimeEnv: {
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_HOSTED_DOMAIN: process.env.GOOGLE_HOSTED_DOMAIN,
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
},
```

**Step 2: Update .env file**

Change:
```
BETTER_AUTH_SECRET=your-secret-here
BETTER_AUTH_URL=http://localhost:3000
```

To:
```
AUTH_SECRET=your-secret-here
```

Note: NextAuth v5 auto-detects AUTH_URL in development. For production, set it in Vercel.

**Step 3: Update .env.example**

```
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# NextAuth.js
AUTH_SECRET=
AUTH_URL=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_HOSTED_DOMAIN=
```

**Step 4: Update NextAuth config to use new env vars**

In `src/server/auth/config.ts`, update to use `env.AUTH_SECRET`:

```typescript
export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  // ...rest of config
});
```

**Step 5: Commit**

```bash
git add src/env.js .env .env.example src/server/auth/config.ts
git commit -m "feat: update environment variables for NextAuth

Replace BETTER_AUTH_* vars with AUTH_* vars for NextAuth.js.
"
```

---

## Task 8: Clean Up Better Auth Files

**Files:**
- Delete: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/server/better-auth/`

**Step 1: Remove Better Auth directory**

Run: `rm -rf /Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/server/better-auth`
Expected: Directory removed

**Step 2: Verify no Better Auth imports remain**

Run: `grep -r "better-auth" /Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src --include="*.ts" --include="*.tsx" | grep -v node_modules`
Expected: No results (all references removed)

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove Better Auth files

Clean up old Better Auth configuration and client files.
"
```

---

## Task 9: Update Google OAuth Redirect URI

**Files:**
- None (Google Cloud Console configuration)

**Step 1: Update authorized redirect URIs in Google Cloud Console**

Go to: https://console.cloud.google.com/apis/credentials

Find your OAuth 2.0 Client ID and update redirect URIs:

Development:
- OLD: `http://localhost:3000/api/auth/callback/google`
- NEW: `http://localhost:3000/api/auth/callback/google`

Production:
- OLD: `https://tiger-den.vercel.app/api/auth/callback/google`
- NEW: `https://tiger-den.vercel.app/api/auth/callback/google`

Note: NextAuth uses the same callback path structure, so URIs remain the same!

**Step 2: Verify no other changes needed**

Google OAuth client ID and secret remain the same - no .env updates needed.

---

## Task 10: Test Locally

**Files:**
- None (testing only)

**Step 1: Start development server**

Run: `npm run dev`
Expected: Server starts on http://localhost:3000

**Step 2: Test sign-in flow**

1. Navigate to http://localhost:3000
2. Click "Sign in with Google"
3. Complete Google OAuth flow
4. Verify redirect to /content page
5. Verify session persists on page refresh

Expected: Successful authentication, no state_mismatch errors

**Step 3: Test protected routes**

1. Sign out (need to add sign-out button - see next task)
2. Try to access /content directly
3. Verify redirect to home page

Expected: Unauthorized users cannot access protected routes

**Step 4: Test database records**

Use Drizzle Studio or Tiger MCP:
```sql
SELECT * FROM tiger_den.users;
SELECT * FROM tiger_den.accounts;
SELECT * FROM tiger_den.sessions;
```

Expected: User, account, and session records created after sign-in

**Step 5: Commit if any fixes needed**

```bash
git add <files>
git commit -m "fix: <description of fix>"
```

---

## Task 11: Add Sign-Out Functionality

**Files:**
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/src/app/layout.tsx`

**Step 1: Update layout with user menu**

Add sign-out button to navigation:

```typescript
import { auth, signOut } from "~/server/auth";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">
        <TRPCReactProvider>
          <nav className="border-b">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
              <div className="flex items-center">
                <Link href="/" className="font-bold text-xl">
                  Tiger Den
                </Link>
                {session?.user && (
                  <div className="ml-8 flex gap-4">
                    <Link href="/content" className="text-sm font-medium hover:underline">
                      Content
                    </Link>
                    <Link href="/campaigns" className="text-sm font-medium hover:underline">
                      Campaigns
                    </Link>
                  </div>
                )}
              </div>
              {session?.user && (
                <form action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}>
                  <button type="submit" className="text-sm font-medium hover:underline">
                    Sign out
                  </button>
                </form>
              )}
            </div>
          </nav>
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
```

**Step 2: Test sign-out**

1. Sign in
2. Click "Sign out" in navigation
3. Verify redirect to home page
4. Verify session cleared (cannot access /content)

Expected: Sign-out works correctly

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add sign-out button to navigation

Add server action sign-out functionality with redirect to home page.
"
```

---

## Task 12: Deploy to Vercel and Test

**Files:**
- None (Vercel configuration)

**Step 1: Update environment variables in Vercel**

Go to Vercel project settings → Environment Variables

Remove:
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

Add:
- `AUTH_SECRET`: (generate new secret with `openssl rand -base64 32`)
- `AUTH_URL`: `https://tiger-den.vercel.app`

Keep existing:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_HOSTED_DOMAIN`
- `DATABASE_URL`

**Step 2: Deploy to Vercel**

Run: `git push` (assuming Vercel auto-deploys from main branch)
Or: Trigger manual deployment in Vercel dashboard

Expected: Successful deployment

**Step 3: Test OAuth on production**

1. Navigate to https://tiger-den.vercel.app
2. Click "Sign in with Google"
3. Complete Google OAuth flow
4. Verify redirect to /content page
5. Verify no state_mismatch errors
6. Test in incognito/private browsing mode
7. Test in different browser

Expected: OAuth works flawlessly on Vercel (no cookie/state issues)

**Step 4: Verify database records in production**

Use Tiger MCP to check production database:
```sql
SELECT * FROM tiger_den.users LIMIT 5;
SELECT * FROM tiger_den.sessions WHERE expires > NOW();
```

Expected: Production authentication working with proper session storage

**Step 5: Document success**

Update CLAUDE.md if authentication section needs updates. Update README.md if setup instructions changed.

---

## Task 13: Update Documentation

**Files:**
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/CLAUDE.md`
- Modify: `/Users/mattstratton/src/github.com/mattstratton/tiger-content/tiger-den/README.md`

**Step 1: Update CLAUDE.md**

Update Tech Stack section:
```markdown
## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Backend**: tRPC, NextAuth.js v5 with Google OAuth
- **Database**: PostgreSQL (TimescaleDB) with Drizzle ORM
- **State Management**: TanStack Query (React Query) v5
```

Update Authentication section:
```markdown
### Authentication
- Google OAuth via NextAuth.js v5
- Domain restriction (GOOGLE_HOSTED_DOMAIN)
- All features require authentication
- Server-side session management
```

**Step 2: Update README.md**

Update Setup Instructions for environment variables:
```markdown
### 3. Configure Authentication

Create a `.env` file with the following variables:

```bash
# Database
DATABASE_URL=your-postgres-connection-string

# NextAuth.js
AUTH_SECRET=your-secret-here  # Generate with: openssl rand -base64 32
AUTH_URL=http://localhost:3000  # Or your production URL

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_HOSTED_DOMAIN=your-domain.com  # Optional: restrict to specific domain
```

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-domain.com/api/auth/callback/google`
4. Copy the Client ID and Client Secret to your `.env` file
```

**Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: update documentation for NextAuth.js

Update tech stack, authentication setup, and environment variable instructions.
"
```

---

## Post-Migration Notes

**What Changed:**
- Authentication library: Better Auth → NextAuth.js v5
- Environment variables: `BETTER_AUTH_*` → `AUTH_*`
- API route: `/api/auth/[...all]` → `/api/auth/[...nextauth]`
- Database tables: `user`, `session`, `account` → `users`, `sessions`, `accounts`
- Session handling: `auth.api.getSession()` → `auth()`
- Sign-in method: Client-side `auth.api.signInSocial()` → Server action `signIn()`

**What Stayed the Same:**
- Google OAuth callback URLs (same path structure)
- Google OAuth client ID and secret
- tRPC router implementations
- Protected procedure logic
- UI components (except auth buttons)
- Database connection and Drizzle ORM

**Why This Fixes the Issue:**
- NextAuth v5 has proven cookie/session management on Vercel edge runtime
- Better Auth had immature state persistence causing `state_mismatch` errors
- NextAuth is the de facto standard for Next.js authentication
- More robust CSRF protection and session handling

**Testing Checklist:**
- ✅ Sign in with Google (localhost)
- ✅ Sign in with Google (production/Vercel)
- ✅ Sign out functionality
- ✅ Session persistence on page refresh
- ✅ Protected routes redirect unauthenticated users
- ✅ tRPC procedures respect authentication
- ✅ Database stores user/session/account data
- ✅ No `state_mismatch` errors
- ✅ Works in incognito/private browsing
- ✅ Works across different browsers

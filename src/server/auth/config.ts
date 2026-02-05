import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { count, eq } from "drizzle-orm";
import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";

import { env } from "~/env";
import { db } from "~/server/db";
import { accounts, sessions, users } from "~/server/db/schema";

// Extend the built-in session type
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "contributor" | "reader";
    } & DefaultSession["user"];
  }

  interface User {
    role: "admin" | "contributor" | "reader";
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }) as any,
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
    // Add role to session
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = user.role;
      }
      return session;
    },
    // First user bootstrap: make first user an admin
    async signIn({ user }) {
      try {
        // Check if this is the first user
        const userCountResult = await db
          .select({ count: count() })
          .from(users)
          .execute();

        const userCount = userCountResult[0]?.count ?? 0;

        // If first user and they don't have admin role yet, make them admin
        if (userCount === 1 && user.id) {
          await db
            .update(users)
            .set({ role: "admin" })
            .where(eq(users.id, user.id))
            .execute();
        }

        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return true; // Still allow sign in even if role assignment fails
      }
    },
  },
});

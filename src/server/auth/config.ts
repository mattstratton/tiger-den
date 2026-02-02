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

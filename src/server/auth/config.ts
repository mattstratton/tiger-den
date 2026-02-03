import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { env } from "~/env";
import { db } from "~/server/db";
import { accounts, sessions, users } from "~/server/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET,
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
});

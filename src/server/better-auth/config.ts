import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { env } from "~/env";
import { db } from "~/server/db";

/**
 * Better Auth Configuration
 *
 * This app uses Google OAuth for authentication with optional domain restriction.
 *
 * To set up Google OAuth:
 * 1. Go to https://console.cloud.google.com/apis/credentials
 * 2. Create a new OAuth 2.0 Client ID (Web application)
 * 3. Add authorized redirect URIs:
 *    - Development: http://localhost:3000/api/auth/callback/google
 *    - Production: https://your-domain.com/api/auth/callback/google
 * 4. Copy the Client ID and Client Secret to your .env file
 * 5. (Optional) Set GOOGLE_HOSTED_DOMAIN to restrict sign-ins to a specific Google Workspace domain
 *
 * Email/password authentication is also enabled as a fallback.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL || "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Conditionally enable Google OAuth only when credentials are provided
  socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          // Domain restriction - only allow sign-ins from specified Google Workspace domain
          // This uses the 'hd' (hosted domain) parameter which is part of Google's OAuth spec
          ...(env.GOOGLE_HOSTED_DOMAIN && {
            authorizationParams: {
              hd: env.GOOGLE_HOSTED_DOMAIN,
            },
          }),
        },
      }
    : undefined,
});

export type Session = typeof auth.$Infer.Session;

import type { Config } from "drizzle-kit";

import { env } from "~/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  schemaFilter: ["tiger_den"],
  migrations: {
    schema: "tiger_den",
  },
} satisfies Config;

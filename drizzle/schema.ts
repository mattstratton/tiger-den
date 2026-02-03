import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  foreignKey,
  index,
  integer,
  pgSchema,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const tigerDen = pgSchema("tiger_den");
export const contentTypeInTigerDen = tigerDen.enum("content_type", [
  "youtube_video",
  "blog_post",
  "case_study",
  "website_content",
  "third_party",
  "other",
]);
export const sourceInTigerDen = tigerDen.enum("source", [
  "manual",
  "csv_import",
  "cms_api",
  "asana_webhook",
]);

export const postInTigerDen = tigerDen.table(
  "post",
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity({
      name: "post_id_seq",
      startWith: 1,
      increment: 1,
      minValue: 1,
      maxValue: 2147483647,
      cache: 1,
    }),
    name: varchar({ length: 256 }),
    createdById: varchar("created_by_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("created_by_idx").using(
      "btree",
      table.createdById.asc().nullsLast().op("text_ops"),
    ),
    index("name_idx").using(
      "btree",
      table.name.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.createdById],
      foreignColumns: [usersInTigerDen.id],
      name: "post_created_by_id_users_id_fk",
    }),
  ],
);

export const usersInTigerDen = tigerDen.table("users", {
  id: text().notNull(),
  name: text(),
  email: text().notNull(),
  emailVerified: timestamp({ mode: "string" }),
  image: text(),
  createdAt: timestamp({ withTimezone: true, mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp({ withTimezone: true, mode: "string" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const accountsInTigerDen = tigerDen.table(
  "accounts",
  {
    userId: text().notNull(),
    type: text().notNull(),
    provider: text().notNull(),
    providerAccountId: text().notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: timestamp("expires_at", { mode: "string" }),
    tokenType: text("token_type"),
    scope: text(),
    idToken: text("id_token"),
    sessionState: text("session_state"),
    createdAt: timestamp({ withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [usersInTigerDen.id],
      name: "accounts_userId_fkey",
    }).onDelete("cascade"),
  ],
);

export const sessionsInTigerDen = tigerDen.table(
  "sessions",
  {
    sessionToken: text().notNull(),
    userId: text().notNull(),
    expires: timestamp({ mode: "string" }).notNull(),
    createdAt: timestamp({ withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp({ withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [usersInTigerDen.id],
      name: "sessions_userId_fkey",
    }).onDelete("cascade"),
  ],
);

export const drizzleMigrationsInTigerDen = tigerDen.table(
  "__drizzle_migrations",
  {
    id: serial().notNull(),
    hash: text().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    createdAt: bigint("created_at", { mode: "number" }),
  },
);

export const contentCampaignsInTigerDen = tigerDen.table(
  "content_campaigns",
  {
    contentItemId: uuid("content_item_id").notNull(),
    campaignId: uuid("campaign_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.campaignId],
      foreignColumns: [campaignsInTigerDen.id],
      name: "content_campaigns_campaign_id_campaigns_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.contentItemId],
      foreignColumns: [contentItemsInTigerDen.id],
      name: "content_campaigns_content_item_id_content_items_id_fk",
    }).onDelete("cascade"),
  ],
);

export const campaignsInTigerDen = tigerDen.table("campaigns", {
  id: uuid().defaultRandom().notNull(),
  name: text().notNull(),
  description: text(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const contentItemsInTigerDen = tigerDen.table(
  "content_items",
  {
    id: uuid().defaultRandom().notNull(),
    title: text().notNull(),
    currentUrl: text("current_url").notNull(),
    previousUrls: text("previous_urls").array(),
    contentType: contentTypeInTigerDen("content_type").notNull(),
    publishDate: date("publish_date"),
    description: text(),
    author: text(),
    targetAudience: text("target_audience"),
    tags: text().array(),
    source: sourceInTigerDen().default("manual").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
  },
  (table) => [
    index("content_items_content_type_idx").using(
      "btree",
      table.contentType.asc().nullsLast().op("enum_ops"),
    ),
    index("content_items_created_at_idx").using(
      "btree",
      table.createdAt.asc().nullsLast().op("timestamp_ops"),
    ),
    index("content_items_current_url_idx").using(
      "btree",
      table.currentUrl.asc().nullsLast().op("text_ops"),
    ),
    index("content_items_publish_date_idx").using(
      "btree",
      table.publishDate.asc().nullsLast().op("date_ops"),
    ),
    foreignKey({
      columns: [table.createdByUserId],
      foreignColumns: [usersInTigerDen.id],
      name: "content_items_created_by_user_id_users_id_fk",
    }).onDelete("cascade"),
  ],
);

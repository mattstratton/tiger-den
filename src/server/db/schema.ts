import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  varchar,
  uuid,
  date,
  pgEnum,
  primaryKey,
} from "drizzle-orm/pg-core";

// Use the dedicated tiger_den schema that was set up by 0perator
const tigerDenSchema = pgSchema("tiger_den");

// Enums in tiger_den schema
export const contentTypeEnum = tigerDenSchema.enum("content_type", [
  "youtube_video",
  "blog_post",
  "case_study",
  "website_content",
  "third_party",
  "other",
]);

export const sourceEnum = tigerDenSchema.enum("source", [
  "manual",
  "csv_import",
  "cms_api",
  "asana_webhook",
]);

export const indexStatusEnum = tigerDenSchema.enum("index_status", [
  "pending",
  "indexed",
  "failed",
]);

export const posts = tigerDenSchema.table(
  "post",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 256 }),
    createdById: varchar("created_by_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),
  },
  (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
  ]
);

// NextAuth.js Tables
export const users = tigerDenSchema.table("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
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
  expires_at: integer("expires_at"),
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

export const userRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  contentItems: many(contentItems),
}));

export const accountRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

// Content Items table
export const contentItems = tigerDenSchema.table("content_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  currentUrl: text("current_url").notNull(),
  previousUrls: text("previous_urls").array(),
  contentType: contentTypeEnum("content_type").notNull(),
  publishDate: date("publish_date"),
  description: text("description"),
  author: text("author"),
  targetAudience: text("target_audience"),
  tags: text("tags").array(),
  source: sourceEnum("source").notNull().default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
}, (table) => ({
  currentUrlIdx: index("content_items_current_url_idx").on(table.currentUrl),
  contentTypeIdx: index("content_items_content_type_idx").on(table.contentType),
  publishDateIdx: index("content_items_publish_date_idx").on(table.publishDate),
  createdAtIdx: index("content_items_created_at_idx").on(table.createdAt),
}));

// Content text storage for full-text search
export const contentText = tigerDenSchema.table("content_text", {
  id: uuid("id").defaultRandom().primaryKey(),
  contentItemId: uuid("content_item_id")
    .notNull()
    .references(() => contentItems.id, { onDelete: "cascade" })
    .unique(),

  // Crawled content
  fullText: text("full_text").notNull(),
  plainText: text("plain_text").notNull(),

  // Metadata
  wordCount: integer("word_count").notNull(),
  tokenCount: integer("token_count").notNull(),
  contentHash: text("content_hash").notNull(),
  crawledAt: timestamp("crawled_at").notNull().defaultNow(),
  crawlDurationMs: integer("crawl_duration_ms"),

  // Status tracking
  indexStatus: indexStatusEnum("index_status").notNull().default("pending"),
  indexError: text("index_error"),
  indexedAt: timestamp("indexed_at"),
}, (table) => ({
  contentItemIdx: index("content_text_item_idx").on(table.contentItemId),
  statusIdx: index("content_text_status_idx").on(table.indexStatus),
}));

// Campaigns table
export const campaigns = tigerDenSchema.table("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Junction table for content items and campaigns
export const contentCampaigns = tigerDenSchema.table(
  "content_campaigns",
  {
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.contentItemId, table.campaignId] }),
  })
);

// Relations
export const contentItemsRelations = relations(contentItems, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [contentItems.createdByUserId],
    references: [users.id],
  }),
  campaigns: many(contentCampaigns),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  contentItems: many(contentCampaigns),
}));

export const contentCampaignsRelations = relations(contentCampaigns, ({ one }) => ({
  contentItem: one(contentItems, {
    fields: [contentCampaigns.contentItemId],
    references: [contentItems.id],
  }),
  campaign: one(campaigns, {
    fields: [contentCampaigns.campaignId],
    references: [campaigns.id],
  }),
}));

export const contentTextRelations = relations(contentText, ({ one, many }) => ({
  contentItem: one(contentItems, {
    fields: [contentText.contentItemId],
    references: [contentItems.id],
  }),
  chunks: many(contentChunks),
}));

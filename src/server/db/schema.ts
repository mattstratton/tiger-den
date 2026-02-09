import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Use the dedicated tiger_den schema that was set up by 0perator
const tigerDenSchema = pgSchema("tiger_den");

// Custom type for pgvector halfvec
const halfvec = customType<{ data: number[]; config?: { dimension?: number } }>({
  dataType(config) {
    return `halfvec(${(config as { dimension?: number } | undefined)?.dimension ?? 1536})`;
  },
  toDriver(value: number[]): string {
    // Convert array to PostgreSQL array format: '[0.1,0.2,0.3]'
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    // Parse PostgreSQL array format back to number array
    if (typeof value === "string") {
      return value
        .slice(1, -1) // Remove brackets
        .split(",")
        .map(Number);
    }
    return value as number[];
  },
});

// Enums in tiger_den schema
export const userRoleEnum = tigerDenSchema.enum("user_role", [
  "admin",
  "contributor",
  "reader",
]);

export const sourceEnum = tigerDenSchema.enum("source", [
  "manual",
  "csv_import",
  "cms_api",
  "asana_webhook",
  "ghost_api",
  "contentful_api",
  "youtube_api",
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
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (t) => [
    index("created_by_idx").on(t.createdById),
    index("name_idx").on(t.name),
  ],
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
  role: userRoleEnum("role").notNull().default("reader"),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const accounts = tigerDenSchema.table(
  "accounts",
  {
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
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

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
export const contentItems = tigerDenSchema.table(
  "content_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    currentUrl: text("current_url").notNull(),
    previousUrls: text("previous_urls").array(),
    contentTypeId: integer("content_type_id")
      .notNull()
      .references(() => contentTypes.id),
    publishDate: date("publish_date"),
    description: text("description"),
    author: text("author"),
    targetAudience: text("target_audience"),
    tags: text("tags").array(),
    source: sourceEnum("source").notNull().default("manual"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    lastModifiedAt: timestamp("last_modified_at", { withTimezone: true }),
    ghostId: text("ghost_id"),
    contentfulId: text("contentful_id"),
    youtubeVideoId: text("youtube_video_id"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    currentUrlIdx: index("content_items_current_url_idx").on(table.currentUrl),
    currentUrlUnique: unique("content_items_current_url_unique").on(
      table.currentUrl,
    ),
    contentTypeIdIdx: index("content_items_content_type_id_idx").on(
      table.contentTypeId,
    ),
    publishDateIdx: index("content_items_publish_date_idx").on(
      table.publishDate,
    ),
    createdAtIdx: index("content_items_created_at_idx").on(table.createdAt),
    ghostIdIdx: index("content_items_ghost_id_idx").on(table.ghostId),
    contentfulIdIdx: index("content_items_contentful_id_idx").on(
      table.contentfulId,
    ),
    youtubeVideoIdIdx: index("content_items_youtube_video_id_idx").on(
      table.youtubeVideoId,
    ),
    lastModifiedAtIdx: index("content_items_last_modified_at_idx").on(
      table.lastModifiedAt,
    ),
  }),
);

// Content text storage for full-text search
export const contentText = tigerDenSchema.table(
  "content_text",
  {
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
  },
  (table) => ({
    contentItemIdx: index("content_text_item_idx").on(table.contentItemId),
    statusIdx: index("content_text_status_idx").on(table.indexStatus),
  }),
);

// Content chunks with embeddings for hybrid search
export const contentChunks = tigerDenSchema.table(
  "content_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contentTextId: uuid("content_text_id")
      .notNull()
      .references(() => contentText.id, { onDelete: "cascade" }),

    // Chunk data
    chunkText: text("chunk_text").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    chunkTokenCount: integer("chunk_token_count").notNull(),

    // Vector embedding (halfvec for 50% storage savings)
    embedding: halfvec("embedding", { dimension: 1536 }),

    // Metadata
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    uniqueChunk: index("content_chunks_unique_idx").on(
      table.contentTextId,
      table.chunkIndex,
    ),
    textIdIdx: index("content_chunks_text_id_idx").on(table.contentTextId),
  }),
);

// API Import Logs table - tracks import history and operations
export const apiImportLogs = tigerDenSchema.table(
  "api_import_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceType: text("source_type").notNull(), // 'ghost', 'contentful_learn', 'contentful_case_study'
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    totalItems: integer("total_items").notNull(),
    createdCount: integer("created_count").default(0),
    updatedCount: integer("updated_count").default(0),
    skippedCount: integer("skipped_count").default(0),
    failedCount: integer("failed_count").default(0),
    errorDetails: jsonb("error_details"),
    dryRun: boolean("dry_run").default(false),
    initiatedByUserId: text("initiated_by_user_id").references(() => users.id),
  },
  (table) => ({
    startedAtIdx: index("api_import_logs_started_at_idx").on(table.startedAt),
    sourceTypeIdx: index("api_import_logs_source_type_idx").on(
      table.sourceType,
    ),
  }),
);

// Campaigns table
export const campaigns = tigerDenSchema.table("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Content Types table
export const contentTypes = tigerDenSchema.table("content_types", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  name: varchar("name", { length: 50 }).notNull(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  color: varchar("color", { length: 20 }).notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  displayOrderIdx: index("content_types_display_order_idx").on(table.displayOrder),
}));

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
  }),
);

// Relations
export const contentItemsRelations = relations(
  contentItems,
  ({ one, many }) => ({
    createdByUser: one(users, {
      fields: [contentItems.createdByUserId],
      references: [users.id],
    }),
    contentTypeRel: one(contentTypes, {
      fields: [contentItems.contentTypeId],
      references: [contentTypes.id],
    }),
    campaigns: many(contentCampaigns),
  }),
);

export const contentTypesRelations = relations(contentTypes, ({ many }) => ({
  contentItems: many(contentItems),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  contentItems: many(contentCampaigns),
}));

export const contentCampaignsRelations = relations(
  contentCampaigns,
  ({ one }) => ({
    contentItem: one(contentItems, {
      fields: [contentCampaigns.contentItemId],
      references: [contentItems.id],
    }),
    campaign: one(campaigns, {
      fields: [contentCampaigns.campaignId],
      references: [campaigns.id],
    }),
  }),
);

export const contentTextRelations = relations(contentText, ({ one, many }) => ({
  contentItem: one(contentItems, {
    fields: [contentText.contentItemId],
    references: [contentItems.id],
  }),
  chunks: many(contentChunks),
}));

export const contentChunksRelations = relations(contentChunks, ({ one }) => ({
  contentText: one(contentText, {
    fields: [contentChunks.contentTextId],
    references: [contentText.id],
  }),
}));

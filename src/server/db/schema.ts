import { relations } from "drizzle-orm";
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

export const posts = tigerDenSchema.table(
  "post",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 256 }),
    createdById: varchar("created_by_id", { length: 255 })
      .notNull()
      .references(() => user.id),
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

export const user = tigerDenSchema.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = tigerDenSchema.table("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = tigerDenSchema.table("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = tigerDenSchema.table("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date()
  ),
});

export const userRelations = relations(user, ({ many }) => ({
  account: many(account),
  session: many(session),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdByUserId: uuid("created_by_user_id").notNull(),
}, (table) => ({
  currentUrlIdx: index("content_items_current_url_idx").on(table.currentUrl),
  contentTypeIdx: index("content_items_content_type_idx").on(table.contentType),
  publishDateIdx: index("content_items_publish_date_idx").on(table.publishDate),
  createdAtIdx: index("content_items_created_at_idx").on(table.createdAt),
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
export const contentItemsRelations = relations(contentItems, ({ many }) => ({
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

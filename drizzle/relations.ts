import { relations } from "drizzle-orm/relations";
import {
  accountsInTigerDen,
  campaignsInTigerDen,
  contentCampaignsInTigerDen,
  contentItemsInTigerDen,
  postInTigerDen,
  sessionsInTigerDen,
  usersInTigerDen,
} from "./schema";

export const postInTigerDenRelations = relations(postInTigerDen, ({ one }) => ({
  usersInTigerDen: one(usersInTigerDen, {
    fields: [postInTigerDen.createdById],
    references: [usersInTigerDen.id],
  }),
}));

export const usersInTigerDenRelations = relations(
  usersInTigerDen,
  ({ many }) => ({
    postInTigerDens: many(postInTigerDen),
    accountsInTigerDens: many(accountsInTigerDen),
    sessionsInTigerDens: many(sessionsInTigerDen),
    contentItemsInTigerDens: many(contentItemsInTigerDen),
  }),
);

export const accountsInTigerDenRelations = relations(
  accountsInTigerDen,
  ({ one }) => ({
    usersInTigerDen: one(usersInTigerDen, {
      fields: [accountsInTigerDen.userId],
      references: [usersInTigerDen.id],
    }),
  }),
);

export const sessionsInTigerDenRelations = relations(
  sessionsInTigerDen,
  ({ one }) => ({
    usersInTigerDen: one(usersInTigerDen, {
      fields: [sessionsInTigerDen.userId],
      references: [usersInTigerDen.id],
    }),
  }),
);

export const contentCampaignsInTigerDenRelations = relations(
  contentCampaignsInTigerDen,
  ({ one }) => ({
    campaignsInTigerDen: one(campaignsInTigerDen, {
      fields: [contentCampaignsInTigerDen.campaignId],
      references: [campaignsInTigerDen.id],
    }),
    contentItemsInTigerDen: one(contentItemsInTigerDen, {
      fields: [contentCampaignsInTigerDen.contentItemId],
      references: [contentItemsInTigerDen.id],
    }),
  }),
);

export const campaignsInTigerDenRelations = relations(
  campaignsInTigerDen,
  ({ many }) => ({
    contentCampaignsInTigerDens: many(contentCampaignsInTigerDen),
  }),
);

export const contentItemsInTigerDenRelations = relations(
  contentItemsInTigerDen,
  ({ one, many }) => ({
    contentCampaignsInTigerDens: many(contentCampaignsInTigerDen),
    usersInTigerDen: one(usersInTigerDen, {
      fields: [contentItemsInTigerDen.createdByUserId],
      references: [usersInTigerDen.id],
    }),
  }),
);

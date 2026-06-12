import { relations } from 'drizzle-orm';
import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const creativeStatus = pgEnum('creative_status', [
  'pending',
  'generating',
  'awaiting_screenshot',
  'complete',
  'failed',
]);

export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  brief: text('brief').notNull(), // markdown
  appIconPath: text('app_icon_path'), // relative to DATA_DIR
  logoPath: text('logo_path'), // relative to DATA_DIR
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const creatives = pgTable(
  'creatives',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    concept: text('concept').notNull(), // one-line idea
    details: text('details').notNull().default(''), // markdown, optional in the form
    status: creativeStatus('status').notNull().default('pending'),
    imagePath: text('image_path'), // relative to DATA_DIR, e.g. images/<id>.png
    error: text('error'),
    // Asset classification (null until the classifier has run; see classifiedAt)
    needsAppIcon: boolean('needs_app_icon'),
    needsLogo: boolean('needs_logo'),
    needsScreenshot: boolean('needs_screenshot'),
    screenshotRequest: text('screenshot_request'), // classifier's description of the screenshot to upload
    screenshotPath: text('screenshot_path'), // user-uploaded, relative to DATA_DIR
    classifiedAt: timestamp('classified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }), // set on claim; drives stale reclaim
    completedAt: timestamp('completed_at', { withTimezone: true }), // doubles as img cache-buster
  },
  (t) => [
    index('creatives_campaign_idx').on(t.campaignId),
    index('creatives_status_idx').on(t.status),
  ],
);

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  creatives: many(creatives),
}));

export const creativesRelations = relations(creatives, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [creatives.campaignId],
    references: [campaigns.id],
  }),
}));

export type CampaignRow = typeof campaigns.$inferSelect;
export type CreativeRow = typeof creatives.$inferSelect;

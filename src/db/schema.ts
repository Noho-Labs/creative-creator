import { relations, sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const campaigns = sqliteTable('campaigns', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  name: text('name').notNull(),
  brief: text('brief').notNull(), // markdown
  appIconPath: text('app_icon_path'), // R2 object key
  logoPath: text('logo_path'), // R2 object key
  createdAt: text('created_at').default(now).notNull(),
});

export const creatives = sqliteTable(
  'creatives',
  {
    id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
    campaignId: text('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    concept: text('concept').notNull(), // one-line idea
    details: text('details').notNull().default(''), // markdown, optional in the form
    status: text('status', { enum: ['pending', 'generating', 'awaiting_screenshot', 'complete', 'failed'] }).notNull().default('pending'),
    reviewStatus: text('review_status', { enum: ['draft', 'in_review', 'approved', 'rejected'] }).notNull().default('draft'),
    version: integer('version').notNull().default(1),
    sentForReviewAt: text('sent_for_review_at'),
    decidedAt: text('decided_at'),
    decidedBy: text('decided_by'),
    revisionNotes: text('revision_notes'),
    imagePath: text('image_path'), // R2 object key, e.g. images/<id>.png
    error: text('error'),
    // Asset classification (null until the classifier has run; see classifiedAt)
    needsAppIcon: integer('needs_app_icon', { mode: 'boolean' }),
    needsLogo: integer('needs_logo', { mode: 'boolean' }),
    needsScreenshot: integer('needs_screenshot', { mode: 'boolean' }),
    screenshotRequest: text('screenshot_request'), // classifier's description of the screenshot to upload
    screenshotPath: text('screenshot_path'), // user-uploaded, R2 object key
    classifiedAt: text('classified_at'),
    createdAt: text('created_at').default(now).notNull(),
    startedAt: text('started_at'), // set on claim; drives stale reclaim
    completedAt: text('completed_at'), // doubles as img cache-buster
  },
  (t) => [
    index('creatives_campaign_idx').on(t.campaignId),
    index('creatives_status_idx').on(t.status),
    check('creative_status_check', sql`${t.status} in ('pending', 'generating', 'awaiting_screenshot', 'complete', 'failed')`),
    check('review_status_check', sql`${t.reviewStatus} in ('draft', 'in_review', 'approved', 'rejected')`),
  ],
);

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  creatives: many(creatives),
}));

export const reviews = sqliteTable('reviews', {
  id: text('id').$defaultFn(() => crypto.randomUUID()).primaryKey(),
  creativeId: text('creative_id').notNull().references(() => creatives.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  reviewerEmail: text('reviewer_email').notNull(),
  decision: text('decision', { enum: ['approve', 'deny', 'changes'] }).notNull(),
  note: text('note').notNull().default(''),
  createdAt: text('created_at').default(now).notNull(),
}, (t) => [
  uniqueIndex('reviews_creative_version_reviewer_idx').on(t.creativeId, t.version, t.reviewerEmail),
  check('review_decision_check', sql`${t.decision} in ('approve', 'deny', 'changes')`),
]);

export type ReviewRow = typeof reviews.$inferSelect;

export const creativesRelations = relations(creatives, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [creatives.campaignId],
    references: [campaigns.id],
  }),
}));

export type CampaignRow = typeof campaigns.$inferSelect;
export type CreativeRow = typeof creatives.$inferSelect;

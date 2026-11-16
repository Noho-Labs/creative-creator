CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brief` text NOT NULL,
	`app_icon_path` text,
	`logo_path` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `creatives` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`concept` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`review_status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`sent_for_review_at` text,
	`decided_at` text,
	`decided_by` text,
	`revision_notes` text,
	`image_path` text,
	`error` text,
	`needs_app_icon` integer,
	`needs_logo` integer,
	`needs_screenshot` integer,
	`screenshot_request` text,
	`screenshot_path` text,
	`classified_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`started_at` text,
	`completed_at` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "creative_status_check" CHECK("creatives"."status" in ('pending', 'generating', 'awaiting_screenshot', 'complete', 'failed')),
	CONSTRAINT "review_status_check" CHECK("creatives"."review_status" in ('draft', 'in_review', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX `creatives_campaign_idx` ON `creatives` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `creatives_status_idx` ON `creatives` (`status`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`creative_id` text NOT NULL,
	`version` integer NOT NULL,
	`reviewer_email` text NOT NULL,
	`decision` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`creative_id`) REFERENCES `creatives`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_decision_check" CHECK("reviews"."decision" in ('approve', 'deny', 'changes'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_creative_version_reviewer_idx` ON `reviews` (`creative_id`,`version`,`reviewer_email`);
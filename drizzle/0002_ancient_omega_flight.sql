CREATE TYPE "public"."review_decision" AS ENUM('approve', 'deny', 'changes');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('draft', 'in_review', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creative_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"reviewer_email" text NOT NULL,
	"decision" "review_decision" NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "review_status" "review_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "sent_for_review_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "decided_by" text;--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "revision_notes" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_creative_id_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."creatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_creative_version_reviewer_idx" ON "reviews" USING btree ("creative_id","version","reviewer_email");
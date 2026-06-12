CREATE TYPE "public"."creative_status" AS ENUM('pending', 'generating', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brief" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"concept" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"status" "creative_status" DEFAULT 'pending' NOT NULL,
	"image_path" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "creatives" ADD CONSTRAINT "creatives_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creatives_campaign_idx" ON "creatives" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "creatives_status_idx" ON "creatives" USING btree ("status");
ALTER TYPE "public"."creative_status" ADD VALUE 'awaiting_screenshot' BEFORE 'complete';--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "app_icon_path" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "logo_path" text;--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "needs_app_icon" boolean;--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "needs_logo" boolean;--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "needs_screenshot" boolean;--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "screenshot_request" text;--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "screenshot_path" text;--> statement-breakpoint
ALTER TABLE "creatives" ADD COLUMN "classified_at" timestamp with time zone;
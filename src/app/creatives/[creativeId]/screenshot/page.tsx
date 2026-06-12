import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ScreenshotUploader } from "@/components/ScreenshotUploader";
import { db } from "@/db/client";
import { creatives } from "@/db/schema";
import { isUuid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

export default async function ScreenshotPage({
  params,
}: {
  params: Promise<{ creativeId: string }>;
}) {
  const { creativeId } = await params;
  if (!isUuid(creativeId)) notFound();

  const creative = await db.query.creatives.findFirst({
    where: eq(creatives.id, creativeId),
    with: { campaign: true },
  });
  if (!creative) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {creative.campaign.name} · screenshot needed
        </p>
        <h1 className="text-2xl font-semibold">{creative.concept}</h1>
      </div>
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        {creative.screenshotRequest ?? "Upload the app screenshot this creative should feature."}
      </div>
      <ScreenshotUploader
        creativeId={creative.id}
        campaignId={creative.campaignId}
        hasScreenshot={!!creative.screenshotPath}
      />
    </div>
  );
}

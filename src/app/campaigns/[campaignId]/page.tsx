import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CreativesBoard } from "@/components/CreativesBoard";
import { Markdown } from "@/components/Markdown";
import { db } from "@/db/client";
import { creatives } from "@/db/schema";
import { toCreativeDTO } from "@/lib/types";
import { isUuid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  if (!isUuid(campaignId)) notFound();

  const campaign = await db.query.campaigns.findFirst({
    where: (c, { eq: eqOp }) => eqOp(c.id, campaignId),
  });
  if (!campaign) notFound();

  const rows = await db
    .select()
    .from(creatives)
    .where(eq(creatives.campaignId, campaignId))
    .orderBy(desc(creatives.createdAt));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{campaign.name}</h1>
        <details
          open={rows.length === 0}
          className="rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <summary className="cursor-pointer select-none text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Brief
          </summary>
          <div className="pt-3">
            <Markdown>{campaign.brief}</Markdown>
          </div>
        </details>
      </div>
      <CreativesBoard campaignId={campaign.id} initialCreatives={rows.map(toCreativeDTO)} />
    </div>
  );
}

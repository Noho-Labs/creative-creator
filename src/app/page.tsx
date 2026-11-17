import { count, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db/client";
import { campaigns, creatives } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = getDb();
  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      createdAt: campaigns.createdAt,
      creativeCount: count(creatives.id),
    })
    .from(campaigns)
    .leftJoin(creatives, eq(creatives.campaignId, campaigns.id))
    .groupBy(campaigns.id)
    .orderBy(desc(campaigns.createdAt));

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">No campaigns yet</h1>
        <p className="text-zinc-500 dark:text-zinc-400">
          Create a campaign with a brief, then queue up creatives to generate images.
        </p>
        <Link
          href="/campaigns/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Create your first campaign
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Campaigns</h1>
      <ul className="flex flex-col gap-3">
        {rows.map((c) => (
          <li key={c.id}>
            <Link
              href={`/campaigns/${c.id}`}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 hover:border-indigo-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-500"
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {c.creativeCount} creative{c.creativeCount === 1 ? "" : "s"} ·{" "}
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { campaigns, creatives } from '@/db/schema';
import { toCreativeDTO } from '@/lib/types';
import { isUuid } from '@/lib/uuid';
import { kickQueue } from '@/server/queue';

type Params = { params: Promise<{ campaignId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { campaignId } = await params;
  if (!isUuid(campaignId)) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  const rows = await db
    .select()
    .from(creatives)
    .where(eq(creatives.campaignId, campaignId))
    .orderBy(desc(creatives.createdAt));
  // Self-healing: a page left open polls this, which revives a restarted server's queue.
  kickQueue();
  return Response.json({ creatives: rows.map(toCreativeDTO) });
}

const createCreative = z.object({
  concept: z.string().trim().min(1, 'concept is required'),
  details: z.string().trim().default(''),
});

export async function POST(request: Request, { params }: Params) {
  const { campaignId } = await params;
  if (!isUuid(campaignId)) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  const body = await request.json().catch(() => null);
  const parsed = createCreative.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid body' },
      { status: 400 },
    );
  }
  const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
  if (!campaign) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  const [row] = await db
    .insert(creatives)
    .values({ campaignId, concept: parsed.data.concept, details: parsed.data.details })
    .returning();
  kickQueue();
  return Response.json({ creative: toCreativeDTO(row) }, { status: 201 });
}

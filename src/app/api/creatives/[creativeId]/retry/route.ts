import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { creatives } from '@/db/schema';
import { isUuid } from '@/lib/uuid';
import { enqueueCreative } from '@/server/queue';

type Params = { params: Promise<{ creativeId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const db = getDb();
  const { creativeId } = await params;
  if (!isUuid(creativeId)) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  const updated = await db
    .update(creatives)
    .set({ status: 'pending', error: null, startedAt: null })
    .where(and(eq(creatives.id, creativeId), eq(creatives.status, 'failed')))
    .returning({ id: creatives.id });
  if (updated.length === 0) {
    return Response.json({ error: 'not found or not failed' }, { status: 404 });
  }
  await enqueueCreative(creativeId);
  return Response.json({ ok: true });
}

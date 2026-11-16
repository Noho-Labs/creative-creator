import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { creatives, reviews } from '@/db/schema';
import { isUuid } from '@/lib/uuid';
import { getViewer } from '@/server/auth';

const reviewInput = z.object({
  decision: z.enum(['approve', 'deny', 'changes']),
  note: z.string().trim().default(''),
  version: z.number().int().positive(),
}).refine((input) => input.decision !== 'changes' || input.note.length > 0, { message: 'A note is required when requesting changes' });

export async function POST(request: Request, { params }: { params: Promise<{ creativeId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { creativeId } = await params;
  if (!isUuid(creativeId)) return Response.json({ error: 'not found' }, { status: 404 });
  const parsed = reviewInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'invalid body' }, { status: 400 });
  return db.transaction(async (tx) => {
    const [creative] = await tx.select().from(creatives).where(eq(creatives.id, creativeId)).for('update');
    if (!creative) return Response.json({ error: 'not found' }, { status: 404 });
    if (creative.version !== parsed.data.version) return Response.json({ error: 'Stale version' }, { status: 409 });
    const [existing] = await tx.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.creativeId, creativeId), eq(reviews.version, parsed.data.version), eq(reviews.reviewerEmail, viewer.email)));
    if (existing) return Response.json({ error: 'Already reviewed' }, { status: 409 });
    if (creative.reviewStatus !== 'in_review' || creative.status !== 'complete') return Response.json({ error: 'Creative is not ready for review' }, { status: 409 });
    const [review] = await tx.insert(reviews).values({ creativeId, reviewerEmail: viewer.email, ...parsed.data }).returning();
    return Response.json({ review }, { status: 201 });
  });
}

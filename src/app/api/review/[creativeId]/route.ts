import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { creatives, reviews } from '@/db/schema';
import { isUuid } from '@/lib/uuid';
import { getViewer } from '@/server/auth';

const reviewInput = z.object({
  decision: z.enum(['approve', 'deny', 'changes']),
  note: z.string().trim().default(''),
  version: z.number().int().positive(),
}).refine((input) => input.decision !== 'changes' || input.note.length > 0, { message: 'A note is required when requesting changes' });

export async function POST(request: Request, { params }: { params: Promise<{ creativeId: string }> }) {
  const db = getDb();
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { creativeId } = await params;
  if (!isUuid(creativeId)) return Response.json({ error: 'not found' }, { status: 404 });
  const parsed = reviewInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'invalid body' }, { status: 400 });
  const { decision, note, version } = parsed.data;
  const [review] = await db.insert(reviews).select(
    db.select({
      id: sql<string>`${crypto.randomUUID()}`.as('id'),
      creativeId: creatives.id,
      version: creatives.version,
      reviewerEmail: sql<string>`${viewer.email}`.as('reviewer_email'),
      decision: sql<typeof decision>`${decision}`.as('decision'),
      note: sql<string>`${note}`.as('note'),
      createdAt: sql<string>`${new Date().toISOString()}`.as('created_at'),
    }).from(creatives).where(and(
      eq(creatives.id, creativeId), eq(creatives.version, version),
      eq(creatives.reviewStatus, 'in_review'), eq(creatives.status, 'complete'),
    )),
  ).onConflictDoNothing({ target: [reviews.creativeId, reviews.version, reviews.reviewerEmail] }).returning();
  if (review) return Response.json({ review }, { status: 201 });
  const [creative] = await db.select().from(creatives).where(eq(creatives.id, creativeId));
  if (!creative) return Response.json({ error: 'not found' }, { status: 404 });
  if (creative.version !== version) return Response.json({ error: 'Stale version' }, { status: 409 });
  const [existing] = await db.select({ id: reviews.id }).from(reviews).where(and(eq(reviews.creativeId, creativeId), eq(reviews.version, version), eq(reviews.reviewerEmail, viewer.email)));
  return Response.json({ error: existing ? 'Already reviewed' : 'Creative is not ready for review' }, { status: 409 });
}

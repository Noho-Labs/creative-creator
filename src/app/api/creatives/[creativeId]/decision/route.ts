import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { creatives } from '@/db/schema';
import { isUuid } from '@/lib/uuid';
import { getViewer } from '@/server/auth';
import { enqueueCreative } from '@/server/queue';
import { creativeDTOs } from '@/server/reviews';

const input = z.object({ action: z.enum(['approve', 'reject', 'revise']), version: z.number().int().positive(), notes: z.string().trim().default('') })
  .refine((value) => value.action !== 'revise' || value.notes.length > 0, { message: 'Revision notes are required' });

export async function POST(request: Request, { params }: { params: Promise<{ creativeId: string }> }) {
  const db = getDb();
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { creativeId } = await params;
  if (!isUuid(creativeId)) return Response.json({ error: 'not found' }, { status: 404 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'invalid body' }, { status: 400 });
  const { action, notes, version } = parsed.data;
  const [row] = await db.update(creatives).set(action === 'revise' ? {
    version: sql`${creatives.version} + 1`, revisionNotes: notes, status: 'pending', error: null, startedAt: null,
    classifiedAt: null, needsScreenshot: null, needsAppIcon: null, needsLogo: null, screenshotRequest: null,
  } : {
    reviewStatus: action === 'approve' ? 'approved' : 'rejected', decidedAt: new Date().toISOString(), decidedBy: viewer.email,
  }).where(and(
    eq(creatives.id, creativeId), eq(creatives.version, version),
    eq(creatives.reviewStatus, 'in_review'), eq(creatives.status, 'complete'),
  )).returning();
  if (!row) {
    const [creative] = await db.select().from(creatives).where(eq(creatives.id, creativeId));
    if (!creative) return Response.json({ error: 'not found' }, { status: 404 });
    return Response.json({ error: creative.version !== version ? 'Stale version' : 'Creative must be complete and in review' }, { status: 409 });
  }
  if (action === 'revise') await enqueueCreative(creativeId);
  return Response.json({ creative: (await creativeDTOs([row]))[0] });
}

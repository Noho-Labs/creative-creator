import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { creatives } from '@/db/schema';
import { isUuid } from '@/lib/uuid';
import { getViewer } from '@/server/auth';
import { kickQueue } from '@/server/queue';
import { creativeDTOs } from '@/server/reviews';

const input = z.object({ action: z.enum(['approve', 'reject', 'revise']), version: z.number().int().positive(), notes: z.string().trim().default('') })
  .refine((value) => value.action !== 'revise' || value.notes.length > 0, { message: 'Revision notes are required' });

export async function POST(request: Request, { params }: { params: Promise<{ creativeId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { creativeId } = await params;
  if (!isUuid(creativeId)) return Response.json({ error: 'not found' }, { status: 404 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? 'invalid body' }, { status: 400 });
  const result = await db.transaction(async (tx) => {
    const [creative] = await tx.select().from(creatives).where(eq(creatives.id, creativeId)).for('update');
    if (!creative) return { error: 'not found', status: 404 };
    if (creative.version !== parsed.data.version) return { error: 'Stale version', status: 409 };
    if (creative.reviewStatus !== 'in_review' || creative.status !== 'complete') return { error: 'Creative must be complete and in review', status: 409 };
    const { action, notes } = parsed.data;
    const [row] = await tx.update(creatives).set(action === 'revise' ? {
      version: creative.version + 1, revisionNotes: notes, status: 'pending', error: null, startedAt: null,
    } : {
      reviewStatus: action === 'approve' ? 'approved' : 'rejected', decidedAt: new Date(), decidedBy: viewer.email,
    }).where(eq(creatives.id, creativeId)).returning();
    return { row };
  });
  if ('error' in result) return Response.json({ error: result.error }, { status: result.status });
  if (parsed.data.action === 'revise') kickQueue();
  return Response.json({ creative: (await creativeDTOs([result.row]))[0] });
}

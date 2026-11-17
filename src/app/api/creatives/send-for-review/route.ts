import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { creatives } from '@/db/schema';
import { creativeDTOs } from '@/server/reviews';

const input = z.object({ ids: z.array(z.uuid()).min(1) });

export async function POST(request: Request) {
  const db = getDb();
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'A list of creative ids is required' }, { status: 400 });
  const moved = await db.update(creatives).set({ reviewStatus: 'in_review', sentForReviewAt: new Date().toISOString() })
    .where(and(inArray(creatives.id, sql`(SELECT value FROM json_each(${JSON.stringify(parsed.data.ids)}))`), eq(creatives.status, 'complete'), eq(creatives.reviewStatus, 'draft'))).returning();
  return Response.json({ creatives: await creativeDTOs(moved) });
}

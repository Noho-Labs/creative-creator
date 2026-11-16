import { z } from 'zod';
import { getDb } from '@/db/client';
import { campaigns } from '@/db/schema';

const createCampaign = z.object({
  name: z.string().trim().min(1, 'name is required'),
  brief: z.string().trim().min(1, 'brief is required'),
});

export async function POST(request: Request) {
  const db = getDb();
  const body = await request.json().catch(() => null);
  const parsed = createCampaign.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? 'invalid body' },
      { status: 400 },
    );
  }
  const [row] = await db.insert(campaigns).values(parsed.data).returning({ id: campaigns.id });
  return Response.json({ id: row.id }, { status: 201 });
}

import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { campaigns } from '@/db/schema';
import { isUuid } from '@/lib/uuid';
import { mimeForPath, getImage } from '@/server/files';

type Params = { params: Promise<{ campaignId: string; kind: string }> };

export async function GET(_request: Request, { params }: Params) {
  const db = getDb();
  const { campaignId, kind } = await params;
  if (!isUuid(campaignId) || (kind !== 'icon' && kind !== 'logo')) {
    return new Response('Not found', { status: 404 });
  }
  const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
  const rel = kind === 'icon' ? campaign?.appIconPath : campaign?.logoPath;
  if (!rel) {
    return new Response('Not found', { status: 404 });
  }
  const data = await getImage(rel);
  if (!data) return new Response('Not found', { status: 404 });
  return new Response(data.body as ReadableStream, {
    headers: { 'Content-Type': mimeForPath(rel), 'Cache-Control': 'private, no-store' },
  });
}

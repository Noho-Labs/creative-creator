import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { campaigns } from '@/db/schema';
import { isUuid } from '@/lib/uuid';
import { mimeForPath, readImage } from '@/server/files';

type Params = { params: Promise<{ campaignId: string; kind: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { campaignId, kind } = await params;
  if (!isUuid(campaignId) || (kind !== 'icon' && kind !== 'logo')) {
    return new Response('Not found', { status: 404 });
  }
  const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
  const rel = kind === 'icon' ? campaign?.appIconPath : campaign?.logoPath;
  if (!rel) {
    return new Response('Not found', { status: 404 });
  }
  const data = await readImage(rel);
  // no-cache: re-uploads reuse the same URL, so always revalidate.
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': mimeForPath(rel), 'Cache-Control': 'no-cache' },
  });
}

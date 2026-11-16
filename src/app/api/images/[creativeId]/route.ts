import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { creatives } from '@/db/schema';
import { isUuid } from '@/lib/uuid';
import { getImage } from '@/server/files';

type Params = { params: Promise<{ creativeId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const db = getDb();
  const { creativeId } = await params;
  if (!isUuid(creativeId)) {
    return new Response('Not found', { status: 404 });
  }
  const row = await db.query.creatives.findFirst({ where: eq(creatives.id, creativeId) });
  if (!row || !row.imagePath) {
    return new Response('Not found', { status: 404 });
  }
  const png = await getImage(row.imagePath);
  if (!png) return new Response('Not found', { status: 404 });
  return new Response(png.body as ReadableStream, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, no-store',
    },
  });
}

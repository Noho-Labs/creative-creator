import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { creatives } from '@/db/schema';
import { isUuid } from '@/lib/uuid';
import { readImage } from '@/server/files';

type Params = { params: Promise<{ creativeId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { creativeId } = await params;
  if (!isUuid(creativeId)) {
    return new Response('Not found', { status: 404 });
  }
  const row = await db.query.creatives.findFirst({ where: eq(creatives.id, creativeId) });
  if (!row || row.status !== 'complete' || !row.imagePath) {
    return new Response('Not found', { status: 404 });
  }
  const png = await readImage(row.imagePath);
  // Immutable is safe: the UI appends ?v=<completedAt>, which changes if regenerated.
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

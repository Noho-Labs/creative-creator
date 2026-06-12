import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { creatives } from '@/db/schema';
import { toCreativeDTO } from '@/lib/types';
import { isUuid } from '@/lib/uuid';
import { mimeForPath, readImage, saveScreenshot } from '@/server/files';
import { kickQueue } from '@/server/queue';
import { isUploadError, readImageUpload } from '@/server/uploads';

type Params = { params: Promise<{ creativeId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { creativeId } = await params;
  if (!isUuid(creativeId)) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  const creative = await db.query.creatives.findFirst({ where: eq(creatives.id, creativeId) });
  if (!creative) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: 'multipart form data required' }, { status: 400 });
  }
  const upload = await readImageUpload(form);
  if (isUploadError(upload)) {
    return Response.json({ error: upload.error }, { status: 400 });
  }

  const rel = await saveScreenshot(creativeId, upload.ext, upload.data);
  // A parked creative goes back into the queue now that its screenshot exists.
  const [updated] = await db
    .update(creatives)
    .set({
      screenshotPath: rel,
      ...(creative.status === 'awaiting_screenshot' ? { status: 'pending' as const } : {}),
    })
    .where(eq(creatives.id, creativeId))
    .returning();
  kickQueue();
  return Response.json({ creative: toCreativeDTO(updated) });
}

export async function GET(_request: Request, { params }: Params) {
  const { creativeId } = await params;
  if (!isUuid(creativeId)) {
    return new Response('Not found', { status: 404 });
  }
  const creative = await db.query.creatives.findFirst({ where: eq(creatives.id, creativeId) });
  if (!creative?.screenshotPath) {
    return new Response('Not found', { status: 404 });
  }
  const data = await readImage(creative.screenshotPath);
  return new Response(new Uint8Array(data), {
    headers: { 'Content-Type': mimeForPath(creative.screenshotPath), 'Cache-Control': 'no-cache' },
  });
}

import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { creatives } from '@/db/schema';
import { toCreativeDTO } from '@/lib/types';
import { isUuid } from '@/lib/uuid';
import { mimeForPath, getImage, saveScreenshot } from '@/server/files';
import { enqueueCreative } from '@/server/queue';
import { isUploadError, readImageUpload } from '@/server/uploads';

type Params = { params: Promise<{ creativeId: string }> };

export async function POST(request: Request, { params }: Params) {
  const db = getDb();
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
  const [[updated]] = await db.batch([
    db.update(creatives).set({ screenshotPath: rel }).where(eq(creatives.id, creativeId)).returning(),
    db.update(creatives).set({ status: 'pending' }).where(and(eq(creatives.id, creativeId), eq(creatives.status, 'awaiting_screenshot'))),
  ]);
  await enqueueCreative(creativeId);
  const current = await db.query.creatives.findFirst({ where: eq(creatives.id, creativeId) });
  return Response.json({ creative: toCreativeDTO(current ?? updated) });
}

export async function GET(_request: Request, { params }: Params) {
  const db = getDb();
  const { creativeId } = await params;
  if (!isUuid(creativeId)) {
    return new Response('Not found', { status: 404 });
  }
  const creative = await db.query.creatives.findFirst({ where: eq(creatives.id, creativeId) });
  if (!creative?.screenshotPath) {
    return new Response('Not found', { status: 404 });
  }
  const data = await getImage(creative.screenshotPath);
  if (!data) return new Response('Not found', { status: 404 });
  return new Response(data.body as ReadableStream, {
    headers: { 'Content-Type': mimeForPath(creative.screenshotPath), 'Cache-Control': 'private, no-store' },
  });
}

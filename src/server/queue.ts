import { and, asc, eq, lt } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { creatives } from '@/db/schema';
import { getEnv } from '@/lib/env';
import { getBindings, type AppBindings } from '@/server/bindings';
import { classifyCreative } from '@/server/classify';
import { mimeForPath, readImage, saveImage } from '@/server/files';
import { buildImagePrompt, generateImage, type ImageAsset } from '@/server/images';

export async function enqueueCreative(creativeId: string): Promise<void> {
  try {
    await getBindings().GEN_QUEUE.send({ creativeId });
  } catch (error) {
    console.error('Generation enqueue failed; scheduled recovery will retry', creativeId, error);
  }
}

export async function recoverPending(bindings: AppBindings): Promise<void> {
  const db = getDb(bindings.DB);
  await db.update(creatives).set({ status: 'pending', startedAt: null }).where(and(
    eq(creatives.status, 'generating'),
    lt(creatives.startedAt, new Date(Date.now() - 15 * 60_000).toISOString()),
  ));
  const pending = await db.select({ id: creatives.id }).from(creatives)
    .where(eq(creatives.status, 'pending')).orderBy(asc(creatives.createdAt)).limit(100);
  if (pending.length) await bindings.GEN_QUEUE.sendBatch(pending.map(({ id }) => ({ body: { creativeId: id } })));
}

export async function processOne(creativeId: string, bindings: AppBindings, lastAttempt: boolean): Promise<void> {
  const db = getDb(bindings.DB);
  const [claimed] = await db.update(creatives).set({ status: 'generating', startedAt: new Date().toISOString() })
    .where(and(eq(creatives.id, creativeId), eq(creatives.status, 'pending'))).returning();
  if (!claimed) return;
  const claim = and(eq(creatives.id, creativeId), eq(creatives.version, claimed.version),
    eq(creatives.status, 'generating'), eq(creatives.startedAt, claimed.startedAt!));
  try {
    const env = getEnv(bindings);
    const creative = await db.query.creatives.findFirst({
      where: eq(creatives.id, creativeId),
      with: { campaign: true },
    });
    if (!creative) return;
    const { campaign } = creative;

    // Step 1: classify which assets this creative version needs.
    let needs = {
      needsScreenshot: creative.needsScreenshot ?? false,
      needsAppIcon: creative.needsAppIcon ?? false,
      needsLogo: creative.needsLogo ?? false,
      screenshotRequest: creative.screenshotRequest,
    };
    if (!creative.classifiedAt) {
      needs = await classifyCreative({
        brief: campaign.brief,
        concept: creative.concept,
        details: creative.details,
        revisionNotes: creative.revisionNotes,
      }, env);
      await db
        .update(creatives)
        .set({ ...needs, classifiedAt: new Date().toISOString() })
        .where(claim);
    }

    // Step 2: a needed screenshot can only come from the user — park the
    // creative until one is uploaded (the upload route re-queues it).
    if (needs.needsScreenshot && !creative.screenshotPath) {
      await db
        .update(creatives)
        .set({ status: 'awaiting_screenshot', startedAt: null })
        .where(claim);
      return;
    }

    // Step 3: if any asset need was flagged, attach the campaign's app icon and
    // logo (whichever are uploaded) plus the creative's screenshot.
    const assets: ImageAsset[] = [];
    if (needs.needsScreenshot || needs.needsAppIcon || needs.needsLogo) {
      const attach = async (rel: string | null, label: string) => {
        if (!rel) return;
        assets.push({ buffer: await readImage(rel, bindings.IMAGES), mime: mimeForPath(rel), label });
      };
      await attach(campaign.appIconPath, 'app icon');
      await attach(campaign.logoPath, 'brand logo');
      await attach(creative.screenshotPath, 'app screenshot');
    }

    const prompt = buildImagePrompt(creative, assets.map((a) => a.label));
    const png = await generateImage(prompt, assets, env);
    const imagePath = await saveImage(creativeId, creative.version, png, bindings.IMAGES);
    await db
      .update(creatives)
      .set({ status: 'complete', imagePath, completedAt: new Date().toISOString(), error: null })
      .where(claim);
  } catch (err) {
    await db
      .update(creatives)
      .set({ status: lastAttempt ? 'failed' : 'pending', startedAt: null, error: err instanceof Error ? err.message : String(err) })
      .where(claim);
    throw err;
  }
}

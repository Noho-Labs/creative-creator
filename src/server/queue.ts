import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { creatives } from '@/db/schema';
import { classifyCreative } from '@/server/classify';
import { mimeForPath, readImage, saveImage } from '@/server/files';
import { buildImagePrompt, generateImage, type ImageAsset } from '@/server/images';

const CONCURRENCY = 2;

// Queue state lives on globalThis (same trick as __pgPool in db/client.ts): a dev
// hot-reload keeps the process — and in-flight generations — alive, while a process
// restart resets this, which is exactly how reclaimOrphans detects orphaned rows.
// Fire-and-forget workers assume a long-lived local Node process; a serverless
// deploy would swap kickQueue for Next's after() or a real queue.
type QueueState = { active: number; reclaimedOnBoot: boolean };
const globalForQueue = globalThis as unknown as { __imageQueue?: QueueState };
const state: QueueState = (globalForQueue.__imageQueue ??= {
  active: 0,
  reclaimedOnBoot: false,
});

export function kickQueue(): void {
  // Sync increment before any await, so concurrent kicks never exceed CONCURRENCY.
  while (state.active < CONCURRENCY) {
    state.active += 1;
    void workerLoop().finally(() => {
      state.active -= 1;
    });
  }
}

async function workerLoop(): Promise<void> {
  await reclaimOrphans();
  for (;;) {
    const id = await claimNext();
    if (!id) return; // queue drained; the next kick respawns workers
    await processOne(id);
  }
}

async function reclaimOrphans(): Promise<void> {
  if (!state.reclaimedOnBoot) {
    // Fresh process: no worker has run yet, so every 'generating' row is orphaned.
    state.reclaimedOnBoot = true;
    await db
      .update(creatives)
      .set({ status: 'pending', startedAt: null })
      .where(eq(creatives.status, 'generating'));
    return;
  }
  // Backstop for anything else, e.g. an API call hung past any sane duration.
  await db.execute(sql`
    UPDATE creatives SET status = 'pending', started_at = NULL
    WHERE status = 'generating' AND started_at < now() - interval '5 minutes'`);
}

async function claimNext(): Promise<string | null> {
  // Atomic claim. SKIP LOCKED keeps this correct if a second process (e.g. a
  // future AI-loop worker) ever shares the table.
  const result = await db.execute(sql`
    UPDATE creatives SET status = 'generating', started_at = now()
    WHERE id = (
      SELECT id FROM creatives WHERE status = 'pending'
      ORDER BY created_at ASC LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id`);
  const row = result.rows[0] as { id: string } | undefined;
  return row?.id ?? null;
}

async function processOne(creativeId: string): Promise<void> {
  try {
    const creative = await db.query.creatives.findFirst({
      where: eq(creatives.id, creativeId),
      with: { campaign: true },
    });
    if (!creative) return;
    const { campaign } = creative;

    // Step 1: classify which assets this creative needs (once per creative).
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
      });
      await db
        .update(creatives)
        .set({ ...needs, classifiedAt: new Date() })
        .where(eq(creatives.id, creativeId));
    }

    // Step 2: a needed screenshot can only come from the user — park the
    // creative until one is uploaded (the upload route re-queues it).
    if (needs.needsScreenshot && !creative.screenshotPath) {
      await db
        .update(creatives)
        .set({ status: 'awaiting_screenshot', startedAt: null })
        .where(eq(creatives.id, creativeId));
      return;
    }

    // Step 3: if any asset need was flagged, attach the campaign's app icon and
    // logo (whichever are uploaded) plus the creative's screenshot.
    const assets: ImageAsset[] = [];
    if (needs.needsScreenshot || needs.needsAppIcon || needs.needsLogo) {
      const attach = async (rel: string | null, label: string) => {
        if (!rel) return;
        assets.push({ buffer: await readImage(rel), mime: mimeForPath(rel), label });
      };
      await attach(campaign.appIconPath, 'app icon');
      await attach(campaign.logoPath, 'brand logo');
      await attach(creative.screenshotPath, 'app screenshot');
    }

    const prompt = buildImagePrompt(creative, assets.map((a) => a.label));
    const png = await generateImage(prompt, assets);
    const imagePath = await saveImage(creativeId, png);
    await db
      .update(creatives)
      .set({ status: 'complete', imagePath, completedAt: new Date(), error: null })
      .where(eq(creatives.id, creativeId));
  } catch (err) {
    await db
      .update(creatives)
      .set({ status: 'failed', error: err instanceof Error ? err.message : String(err) })
      .where(eq(creatives.id, creativeId));
  }
}

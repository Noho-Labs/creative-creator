import { eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { creatives } from '@/db/schema';
import { saveImage } from '@/server/files';
import { buildImagePrompt, generateImage } from '@/server/images';

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
    const row = await claimNext();
    if (!row) return; // queue drained; the next kick respawns workers
    await processOne(row);
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

type ClaimedRow = { id: string; concept: string; details: string };

async function claimNext(): Promise<ClaimedRow | null> {
  // Atomic claim. SKIP LOCKED keeps this correct if a second process (e.g. a
  // future AI-loop worker) ever shares the table.
  const result = await db.execute(sql`
    UPDATE creatives SET status = 'generating', started_at = now()
    WHERE id = (
      SELECT id FROM creatives WHERE status = 'pending'
      ORDER BY created_at ASC LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, concept, details`);
  return (result.rows[0] as ClaimedRow | undefined) ?? null;
}

async function processOne(row: ClaimedRow): Promise<void> {
  try {
    const png = await generateImage(buildImagePrompt(row));
    const imagePath = await saveImage(row.id, png);
    await db
      .update(creatives)
      .set({ status: 'complete', imagePath, completedAt: new Date(), error: null })
      .where(eq(creatives.id, row.id));
  } catch (err) {
    await db
      .update(creatives)
      .set({ status: 'failed', error: err instanceof Error ? err.message : String(err) })
      .where(eq(creatives.id, row.id));
  }
}

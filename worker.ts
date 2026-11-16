import type { ExportedHandler } from '@cloudflare/workers-types';
import handler from './.open-next/worker.js';
import type { AppBindings, GenerationJob } from './src/server/bindings';
import { processOne, recoverPending } from './src/server/queue';

export default {
  fetch: handler.fetch,
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await processOne(message.body.creativeId, env, message.attempts >= 4);
        message.ack();
      } catch (error) {
        console.error('Generation failed', message.body.creativeId, error);
        message.retry();
      }
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(recoverPending(env));
  },
} satisfies ExportedHandler<AppBindings, GenerationJob>;

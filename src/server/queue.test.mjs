import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: ['src/server/queue.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  packages: 'external',
  plugins: [{
    name: 'test-bindings',
    setup(build) {
      build.onResolve({ filter: /^@\/server\/bindings$/ }, () => ({ path: 'bindings', namespace: 'test' }));
      build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
        contents: 'export function getBindings() { return globalThis.__queueTestBindings(); }',
      }));
    },
  }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { enqueueCreative } = module.exports;

test('enqueueCreative sends the committed creative id', async (t) => {
  const send = t.mock.fn(async () => {});
  const log = t.mock.method(console, 'error', () => {});
  globalThis.__queueTestBindings = () => ({ GEN_QUEUE: { send } });
  await enqueueCreative('creative-id');
  assert.equal(send.mock.callCount(), 1);
  assert.deepEqual(send.mock.calls[0].arguments, [{ creativeId: 'creative-id' }]);
  assert.equal(log.mock.callCount(), 0);
});

test('enqueueCreative logs a failed send without rejecting the successful write', async (t) => {
  const error = new Error('Queue unavailable');
  const log = t.mock.method(console, 'error', () => {});
  globalThis.__queueTestBindings = () => ({ GEN_QUEUE: { send: async () => { throw error; } } });
  await assert.doesNotReject(enqueueCreative('committed-id'));
  assert.deepEqual(log.mock.calls[0].arguments, [
    'Generation enqueue failed; scheduled recovery will retry', 'committed-id', error,
  ]);
});

test('enqueueCreative also tolerates an unavailable binding after a successful write', async (t) => {
  const error = new Error('Binding unavailable');
  const log = t.mock.method(console, 'error', () => {});
  globalThis.__queueTestBindings = () => { throw error; };
  await assert.doesNotReject(enqueueCreative('committed-id'));
  assert.equal(log.mock.calls[0].arguments[2], error);
});

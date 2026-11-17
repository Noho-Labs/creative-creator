declare module '*.open-next/worker.js' {
  const handler: { fetch: import('@cloudflare/workers-types').ExportedHandlerFetchHandler };
  export default handler;
}

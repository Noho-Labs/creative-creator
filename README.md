# Creative Creator

Personal ad-creative generator with a shared SSO review queue. Campaign briefs and creative concepts drive OpenAI image generation; reviewers approve, deny or request changes, and creators make the final decision.

## Cloudflare architecture

- Next.js 16.4.6 on Workers via OpenNext Cloudflare. Node compatibility is enabled; the existing Next `proxy.ts` centralizes identity and creator/reviewer access. OpenNext currently labels Node middleware support **experimental**; preview smoke covers this proxy, but retest Access after deployment.
- Drizzle SQLite schema on **D1** (`DB`). All timestamps are UTC ISO-8601 text. Conditional writes claim pending jobs and guard creator decisions by version/status. Review submission is one conditional `INSERT ... SELECT` with a unique creative/version/reviewer constraint. D1 batches atomically update screenshot state and read queue/count snapshots; no interactive transactions or PostgreSQL locks.
- **R2** (`IMAGES`) stores generated images, icons, logos and screenshots. Routes stream objects with `private, no-store`; buckets must not be public. Generated images use unique versioned keys so the old image stays visible until regeneration finishes.
- **Queues** (`GEN_QUEUE`) carries `{creativeId}` on create, retry, revise and screenshot upload. The custom `worker.ts` delegates fetch to OpenNext and runs generation from `queue()`. Consumer concurrency is 2, with one job per batch and three retries (four total attempts), 60 seconds apart. Exceptions return the creative to pending; the final failed attempt marks it failed, allowing the Retry button.
- A five-minute cron re-enqueues up to 100 pending creatives and reclaims generating rows older than 15 minutes. This covers the D1-write/Queue-send gap and worker termination, which Queue retries alone cannot cover. Claims are atomic and duplicate deliveries are harmless; writes check the claimed version and start time so an abandoned attempt cannot overwrite a replacement's DB state. A crash may duplicate a paid OpenAI request; this is at-least-once processing, not exactly-once billing.

No PostgreSQL or local filesystem storage remains. These migrations initialize a **new D1 database**; they do not import existing Postgres rows or `data/` assets. Back up existing data before cutover and plan a separate import if it must be retained.

## Local Workers preview (recommended)

Requires Node.js 22.12+ (Wrangler's minimum), npm, Python 3 and curl for the smoke.

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate
npm run preview                 # http://localhost:8787
```

Wrangler emulates D1, R2 and the Queue consumer locally under ignored `.wrangler/state/`. No Cloudflare login/resources are needed for this flow. The example uses mock images, so there is no API spend. For real generation, put `OPENAI_API_KEY` in ignored `.dev.vars` and set `MOCK_IMAGES=false` there.

`npm run dev` offers Next HMR at port 3000; `initOpenNextCloudflareForDev` supplies local D1/R2 bindings. Use Workers preview for the full asynchronous generation/Queue workflow and production-runtime verification. Do not run two local consumers against the same Queue/state concurrently. `next start` alone does not provide Workers bindings.

After a build, `npm run preview:worker -- --port 3000` starts preview without rebuilding. If app source changes, rebuild first with `npm run build:worker`.

## Identity

Only explicit local `DEV_AUTH=true` enables `DEV_USER_EMAIL` (default `dev@noholabs.com`) and `x-dev-user-email` overrides. Put it in local `.dev.vars` / `.env` only, **never deployed Worker vars/secrets or wrangler.jsonc**. The tracked `.env` contains Next-local mock defaults; actual request identity reads Workers bindings, not build-time `NODE_ENV`.

Without that flag, every request requires a valid `Cf-Access-Jwt-Assertion`. `jose` uses Workers Web Crypto and Cloudflare Access JWKS, checking signature, issuer and audience. Spoofed dev headers do not bypass JWT verification. `CREATOR_EMAILS` is comma-separated and case-insensitive. Non-creators can only access `/review`, review APIs and generated-image routes.

## Brand assets and reviews

Upload an app icon/logo on the campaign board. The classifier decides which assets a creative needs; screenshots park it in `awaiting_screenshot` until uploaded. Revision notes trigger fresh classification and are included in image prompts. Mock mode uses keywords such as “screenshot”, “icon”, and “logo” to exercise this flow.

Creators send finished drafts for review, then approve/reject or revise with notes. Reviewers see the oldest eligible creative not yet reviewed at its current version; changes require notes. Revisions increment the version, regenerate, and return to every reviewer's queue. Stale versions and duplicate reviews return 409; invalid notes/versions return 400 and creator-only APIs return 403 for reviewers.

## Deploy to Cloudflare

Use the intended NOHO Cloudflare account (`npx wrangler login` / account-scoped API token). Resource commands below create live resources; local preview above does not.

1. Create resources:
   ```sh
   npx wrangler d1 create creative-creator
   npx wrangler r2 bucket create creative-creator-images
   npx wrangler queues create creative-generation
   ```
2. Replace the zero `database_id` placeholder in `wrangler.jsonc` with the returned D1 UUID. Confirm resource names/account. Keep the `DB`, `IMAGES`, `GEN_QUEUE`, `ASSETS` and self-reference service binding names unchanged. No R2 public access is needed.
3. In Zero Trust → Access → Applications, create a **self-hosted** application for `creative.noholabs.com`, including all paths. Require the organization's Google SSO identity provider and an explicit colleague/domain allow policy; do not add a bypass policy. Copy its application audience (AUD) tag and team domain to `CF_ACCESS_AUD` and `CF_ACCESS_TEAM_DOMAIN` in Wrangler vars. Set `CREATOR_EMAILS` to the creators and `MOCK_IMAGES=false` for real generation.
4. Store the API key as a Worker secret:
   ```sh
   npx wrangler secret put OPENAI_API_KEY
   ```
   Optional model vars: `OPENAI_IMAGE_MODEL=gpt-image-2`, `OPENAI_TEXT_MODEL=gpt-5.4-mini`, `OPENAI_IMAGE_SIZE=1024x1536`, `OPENAI_IMAGE_QUALITY=medium`.
5. Apply migrations **before** deploy:
   ```sh
   npm run db:migrate:remote
   npm run deploy
   ```
6. Add a Worker **Custom Domain** for `creative.noholabs.com` (Workers & Pages → creative-creator → Settings → Domains & Routes). Cloudflare creates the proxied DNS record; remove any conflicting record first. Ensure Access protects the same hostname before sharing it. Disable the public `workers.dev`/preview URLs in Worker settings; app-level JWT verification remains a second gate even on alternate hostnames.
7. Verify real SSO on that hostname, check creator/reviewer permissions, and confirm Queue consumer/cron events and R2 images with a mock campaign before enabling real API spend. Missing/invalid JWTs must still return 401 when hitting the origin without Access. Never set `DEV_AUTH` in deployed configuration.

`npm run deploy` builds the OpenNext bundle and deploys the custom worker, including Queue consumer and cron configuration. No deployment has been performed by the local smoke.

## Verification

```sh
npm run typecheck
npm run lint
npm run build:worker
npm run preview:worker -- --port 3000
# In another shell, with an initially empty global review queue:
python3 -u smoke_workers.py --queue-errors
```

The smoke creates synthetic campaigns; it covers the lifecycle, stale/duplicate/error/permission responses, concurrent decisions/reviews, R2 asset round-trips, and real local Queue delivery. `--queue-errors` deliberately points one synthetic creative at a missing R2 object using **local** D1, waits about three minutes for all four consumer attempts, then uploads a replacement and verifies retry. Omit the flag for the shorter lifecycle test. Optional `--local-extras` tests 101-id review selections against D1's parameter limit and invokes cron recovery for unsent/stale jobs; start preview with `--test-scheduled` for this option. Configure `SMOKE_BASE` / `SMOKE_CREATOR` if needed (fault injection requires localhost:3000). Successful runs finalize their in-review creatives; interrupted runs can leave test items in the queue, so use fresh local state or finalize those synthetic items before rerunning.

For the auth-negative check, stop preview, remove `DEV_AUTH` from local `.dev.vars`, restart the **same built bundle**, and request `/api/review` with no JWT, an invalid JWT, and each with `x-dev-user-email: richard@noholabs.com`: all must return 401. Restore the local flag afterward. A valid Access JWT requires the deployed Access app and is a separate deployment check.

Scripts: `dev`, `build` (Next only), `build:worker`, `preview`, `preview:worker`, `deploy`, `lint`, `typecheck`, `db:generate`, `db:migrate` (local), `db:migrate:remote`.

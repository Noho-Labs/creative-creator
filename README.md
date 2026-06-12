# Creative Creator

Personal tool for generating ad creatives. A **campaign** has a name and a markdown brief; it contains **creatives** (a one-line concept + optional markdown details). Saving a creative queues an OpenAI **gpt-image-2** generation — images land in `data/images/` and show up on the campaign board as they finish. Queue 5–10 at a time; the form clears and refocuses after each save.

## Run it

```sh
createdb creative_creator   # once — local Homebrew Postgres, trust auth
npm install
npm run db:migrate
npm run dev                 # http://localhost:3000
```

That's it — by default `MOCK_IMAGES=true` (see `.env`), so the whole flow runs with placeholder images and zero API spend.

## Real image generation

```sh
cp .env.local.example .env.local   # then set OPENAI_API_KEY and MOCK_IMAGES=false
```

Optional overrides in `.env.local`: `OPENAI_IMAGE_MODEL` (default `gpt-image-2`), `OPENAI_IMAGE_SIZE` (default `1024x1536` portrait), `OPENAI_IMAGE_QUALITY` (default `medium`).

## Brand assets

Each campaign can store an **app icon** and a **logo** (upload slots on the campaign page). Before generating, a classifier (`OPENAI_TEXT_MODEL`, default `gpt-5.4-mini`) reads the brief + creative and decides whether the ad needs the app's UI, the icon, or the logo. If any are needed, the stored icon/logo are attached to the gpt-image-2 request (`images.edit` with multiple input images). If an **app screenshot** is needed, the creative parks as `awaiting_screenshot` with a one-line request describing which screen to capture — an upload page collects it, then generation resumes automatically. In mock mode the classifier is a keyword heuristic (mention "logo", "icon", or "screenshot" in a concept to exercise each path).

## How it works

- **DB**: Drizzle + Postgres (`src/db/schema.ts`). `creatives.status` (`pending → generating → awaiting_screenshot | complete | failed`) is the queue's source of truth.
- **Queue** (`src/server/queue.ts`): in-process, concurrency 2. Rows are claimed with `FOR UPDATE SKIP LOCKED`; a process restart reclaims orphaned `generating` rows on the next kick. Any open campaign page polls every 2s, which also re-kicks the queue — so a restarted server self-heals.
- **Images**: written to `data/images/<creativeId>.png` (gitignored), served by `/api/images/[creativeId]` with immutable caching (`?v=<completedAt>` busts it on regenerate).
- **API**: `POST /api/campaigns`, `GET|POST /api/campaigns/[id]/creatives`, `POST /api/creatives/[id]/retry`.

## Future

The planned AI loop (AI writes briefs/creatives on a schedule) slots in as a worker/cron that POSTs to the same endpoints — the `SKIP LOCKED` claim already tolerates a second process.

## Scripts

`dev` · `build` · `start` · `lint` · `typecheck` · `db:generate` · `db:migrate` · `db:push` · `db:studio`

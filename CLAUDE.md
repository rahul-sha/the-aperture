# The Aperture

## What this project does
Rahul Sharma's photography portfolio: a quiet 3D walk through his photos, with an All photos view, a lightbox, a right-click mode dial, and a behind the scenes page. Live at https://www.the-aperture.app (Vercel). Rahul adds photos to Immich albums at home; a sync copies web-sized versions to Cloudflare R2, and the site reads them from there.

## Tech stack
- Next.js 16 (App Router), React 19, plain JavaScript, no database. three.js draws the walk.
- Hosting: Vercel (team mamba-inc), auto-deploys from `main`.
- Photos: Cloudflare R2 bucket served at https://photos.the-aperture.app, with `manifest.json` listing them.
- Sync: `scripts/immich-to-r2.mjs`, run as the container `ghcr.io/rahul-sha/the-aperture-sync` (built by `.github/workflows/sync-image.yml`) on Rahul's Synology NAS through Dockhand.
- Tests: Playwright, driven by `tests/run.mjs`.

## Run commands
- Install: `npm install` (Node.js 22 or newer).
- Start: `npm run dev`, then open http://localhost:3000.
- Build and test: `npm run build && npm test`. There is no way to run a single test; `tests/e2e.mjs` runs them all in order.
- First time on a new computer: `npx playwright install chromium`.
- Rebuild the local photo list: `npm run photos:local`. Sync from Immich: `npm run photos:sync` (needs `.env`).
- Deploy: merge to `main`; Vercel deploys. Sync changes also need the NAS stack redeployed (see README).

## Where things live
- `components/`: the walk, All photos, lightbox, mode dial, cursor. `app/behind-the-scenes/`: the behind the scenes page.
- `content/`: the words on the site (`about.json`, `sections.json`, `captions.json`, `curated.json`).
- `docs/DESIGN-SYSTEM.md`: the Drift design system. `docs/roadmap.md`: the plan. `docs/bugs.md`: known bugs.
- Trilium, under Vibe Coding Projects: the build map, design system, and notes for this project.

## Data and safety
- `main` is the live site. The repository is public.
- Real photos come from Rahul's Immich. Never publish exact GPS; the sync strips all location data.
- Secret settings (names only): `IMMICH_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, kept in the Dockhand stack or a local `.env`, never committed. `PHOTOS_MANIFEST_URL` is set on Vercel by Rahul.

## How to work
- This project uses the Cartographer plugin. Its project rules are in `.claude/rules/project-rules.md`, the bug list in `docs/bugs.md`, and the plan in `docs/roadmap.md`.
- New feature, or a change across several files: show a short plan first and wait for Rahul's OK. Small fixes go straight ahead.
- Work on a branch with one small pull request per step. Never push to `main`. Rahul merges pull requests himself.
- Rahul is new to Linux and programming: explain each step plainly, give exact commands, and say where to click.
- UK English with the Oxford comma. No emojis, filler, or hype.

## Conventions and decisions
- Design is Drift (`docs/DESIGN-SYSTEM.md`); the design rules for this project are in `.claude/rules/project-rules.md`.
- Without `PHOTOS_MANIFEST_URL` the site falls back to the committed `content/photos.json`: keeps local builds working.
- The site re-reads the manifest at most once an hour: keeps Vercel quiet; new photos appear within the hour.
- Untitled photos get "City, Month Year" titles: Rahul prefers not to write descriptions by hand.

# The Aperture

Rahul Sharma's photography portfolio. A Next.js site hosted on Vercel, with
web-sized photos served from Cloudflare R2 and the originals managed privately
in Immich at home.

## Tech stack

<table>
  <tr>
    <th width="130">Back-end</th>
    <th width="190">Front-end</th>
    <th width="130">Data</th>
    <th width="150">Hosting</th>
    <th width="130">Other</th>
  </tr>
  <tr>
    <td align="center">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/nodejs/nodejs-original.svg" height="36" alt="Node.js" title="Node.js">
    </td>
    <td align="center">
      <img src="https://cdn.simpleicons.org/nextdotjs/000/fff" height="36" alt="Next.js" title="Next.js">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/react/react-original.svg" height="36" alt="React" title="React">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/javascript/javascript-original.svg" height="36" alt="JavaScript" title="JavaScript">
      <img src="https://cdn.simpleicons.org/threedotjs/000/fff" height="36" alt="three.js" title="three.js">
    </td>
    <td align="center">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/cloudflare/cloudflare-original.svg" height="36" alt="Cloudflare R2" title="Cloudflare R2">
      <img src="https://cdn.simpleicons.org/immich" height="36" alt="Immich" title="Immich">
    </td>
    <td align="center">
      <img src="https://cdn.simpleicons.org/vercel/000/fff" height="36" alt="Vercel" title="Vercel">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/docker/docker-original.svg" height="36" alt="Docker" title="Docker">
      <img src="https://cdn.simpleicons.org/synology" height="36" alt="Synology" title="Synology">
    </td>
    <td align="center">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/playwright/playwright-original.svg" height="36" alt="Playwright" title="Playwright">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons/githubactions/githubactions-original.svg" height="36" alt="GitHub Actions" title="GitHub Actions">
    </td>
  </tr>
  <tr>
    <td align="center" valign="top"><sub>Node.js 22 or newer</sub></td>
    <td align="center" valign="top"><sub>Next.js 16 (App Router)<br>React 19<br>Plain JavaScript<br>three.js for the walk</sub></td>
    <td align="center" valign="top"><sub>Cloudflare R2 (photos and manifest)<br>Immich at home (originals)<br>No database</sub></td>
    <td align="center" valign="top"><sub>Vercel (the site)<br>Docker sync container<br>Synology NAS via Dockhand</sub></td>
    <td align="center" valign="top"><sub>Playwright checks<br>GitHub Actions (sync image)<br>sharp for resizing</sub></td>
  </tr>
</table>

## What it does

- A quiet 3D walk through the photos, section by section, with a timeline to jump around.
- An All photos view, and a lightbox for each photo with its title, caption, and place name.
- A right-click (or touch and hold) mode dial to move between Start, Photos, About, The making of, and Socials.
- A behind the scenes page on how the site was made.
- Photos come from Immich albums at home; a sync copies web-sized versions, without location data, to Cloudflare R2.

Live at https://www.the-aperture.app.

How the pieces fit together:

```
Immich (home, private)  --npm run photos:sync-->  Cloudflare R2 (public photos + manifest.json)
                                                        |
                                                        v
                                        Vercel builds the site from this repo
                                        and reads manifest.json once an hour
```

## Running the site on your computer

You need Node.js 22 or newer.

```bash
npm install          # first time only
npm run dev          # then open http://localhost:3000
```

The site reads `content/photos.json`. A copy built from the photos in this
repository is committed, so the site works straight away.

## Editing the words on the page

The words in the walk-through (the welcome, its line, and your headline near the start; the quote, bio, Now line, and links at the end) come from `content/about.json`. The site reads it from this repository at build time, so edit it, commit, and Vercel redeploys with the new text. No sync run is needed for that.

These files are plain text. Change them, save, and reload:

- `content/about.json`: your name, city, headline, bio, quote, the "Now" line,
  and social links. Add an `"email"` line to show an "Email me" link
  again; without one the site has no email link.
- `content/sections.json`: the one-line quote under each section name, and
  the order the sections appear in. When Immich is connected, the album
  description replaces the quote; the order still comes from here.
- `content/captions.json`: titles and captions for the photos in the
  repository, keyed by file name. When Immich is connected, each photo's
  description replaces this (first line is the title, the rest is the caption).
- `content/behind-the-scenes.json`: the build log and speed charts on the
  behind the scenes page (plain words, no system names).
- `content/curated.json`: which photos go in the intro collage, which is
  featured, and which is "latest". When Immich is connected, the album
  "Portfolio - Intro" picks the collage instead.

After changing `captions.json`, `sections.json`, or `curated.json`, rebuild
the local photo list with `npm run photos:local`. That only changes local
copies and previews without `PHOTOS_MANIFEST_URL`. On the live site the
section order and fallback quotes come from the manifest the sync writes, so
a change there needs the merge, the sync image build (about 3 minutes), then
"Pull + recreate" on the Dockhand stack.

## Publishing photos from Immich

Set up once, in Immich:

1. Create one album per section, named exactly `Portfolio - Overview`,
   `Portfolio - Reflections`, and so on. The order on the site is the order
   of the sections in `content/sections.json` (currently Overview,
   Reflections, Landscapes, Nature, Abstract, Portraits, Miscellaneous).
2. Give each album a description. It becomes the quote under the section name.
3. Optionally give a photo a description. The first line is its title, any
   further lines are the caption shown in the lightbox. Photos without one
   are titled "City, Month Year" (or "Section, no. N" when there is no
   location), so file names never show.
4. Create an album `Portfolio - Intro` with the nine or more photos you want
   flying in on the landing screen.
5. In Immich, open Account settings, then API keys, and create a key.

Set up once, in Cloudflare:

1. Create an R2 bucket (for example `aperture-photos`) and connect a custom
   domain to it, such as `photos.the-aperture.app`.
2. Create an R2 API token with edit access to that bucket.

Then run the sync, either as a container on the NAS (no Node.js needed) or
on your computer.

**On the NAS, with Dockhand or any Docker host:** create a stack from
`docker-compose.sync.yml`, fill in the environment variables it lists
(`IMMICH_URL` must be the NAS's LAN address, such as
`http://192.168.1.10:2283`), and deploy. GitHub builds the image
(`ghcr.io/rahul-sha/the-aperture-sync`) whenever the sync code changes; the
NAS pulls it, runs it once, prints its progress, and exits. Deploy it again
whenever you change the albums. After a change to the sync code, wait for the
image build to finish (about 3 minutes), then choose "Pull + recreate" on the
Dockhand stack so the NAS uses the new image. Its memory of what was uploaded lives in the
`sync-state` volume.

The sync has its own version number and release notes in
`docs/sync-changelog.md`. When you change the sync, add a new entry at the top
with a higher number (last number for a fix, middle for something new). After
the merge, GitHub tags the image with that number as well as `latest` and
publishes the notes on the repository's
[Releases page](https://github.com/rahul-sha/the-aperture/releases). The image
is labelled with that page, so Dockhand's release notes icon opens it.

The image holds only what the sync needs: Node.js, sharp, exif-reader, and
the R2 client. The sync runs as the limited `node` user rather than root (the
entrypoint hands the `sync-state` volume to that user first). npm is removed
after install, and Debian's security updates are applied at build time, so the NAS's vulnerability scanner has little to flag.
Rebuilding the image (or running the workflow by hand from GitHub's Actions
tab) picks up newer Debian fixes. A pull request that touches the sync code
builds the image as a check, with read-only access, so it can never publish it. After a new image, delete
the older copy in Dockhand's Images page so it is not scanned twice.

**On your computer, with Node.js installed:**

```bash
cp .env.example .env     # fill in the values
npm run photos:sync
```

Run the sync whenever you change the albums. It only uploads new
or changed photos, removes photos you took out of the albums, strips all
location data, and writes `manifest.json` to the bucket.

Location is handled in two ways. Each photo gets a place label (city and country, as worked out by Immich) shown under its caption, and the manifest carries photo counts snapped to a coarse grid (5 km cells by default, `LOCATION_GRID_KM` in `.env` changes it) for a future map tile. Exact coordinates never leave Immich, and photos without GPS data simply get no label.

## Checking that it works

```bash
npm test
```

This first checks the version number: a change to what visitors see (files in
`app/`, `components/`, `lib/`, `content/`, or `public/`) must raise the
`version` in `package.json`, shown at the end of the behind the scenes page.
Use the last number for a fix, the middle for a feature, the first for a
redesign. It then builds the site, starts it, drives it with a real browser (Playwright), checks
the walk-through, the drift (that it moves, pauses when you scroll, and
resumes), dragging the timeline, All photos, the lightbox, keyboard focus, the
page shown when a browser can't draw 3D, and the phone layout, and saves screenshots in `tests/screenshots/`.
The first time on a new computer, run `npx playwright install chromium` first.

## Deploying on Vercel

1. Import this repository as a new Vercel project. The defaults work.
2. Add one environment variable: `PHOTOS_MANIFEST_URL` set to
   `https://photos.the-aperture.app/manifest.json` (your bucket's domain).
3. Deploy. The site re-reads the manifest at most once an hour, so new photos
   appear without another deploy.

Without `PHOTOS_MANIFEST_URL` the site uses the committed `content/photos.json`.

After that, merging a pull request into `main` deploys the site. Pull requests
that change only Markdown files or `docs/` skip the Vercel preview
(`scripts/ignore-build.sh`, set in `vercel.json`), which saves build minutes;
the live site always builds. Changes to the
sync code, or to `sections.json`, `captions.json`, or `curated.json`, also
need "Pull + recreate" on the Dockhand stack.

## Design

`docs/DESIGN-SYSTEM.md` lists the colours, type, and components of the Drift
design, with the rules that keep new work consistent and an accessibility
checklist.

## Where things live

| Where | What |
| --- | --- |
| `components/` | The walk, All photos, lightbox, mode dial, and cursor |
| `app/behind-the-scenes/` | The behind the scenes page |
| `content/` | The words on the site |
| `scripts/` | The Immich to R2 sync, the local photo list, and the Vercel preview skip |
| `tests/` | The Playwright checks |
| `docs/DESIGN-SYSTEM.md` | The Drift design system |
| `docs/roadmap.md` | The plan |
| `docs/bugs.md` | Known bugs |
| `docs/sync-changelog.md` | Version and release notes for the sync image |
| `CLAUDE.md` | Notes for Claude on how the project works |
| `.claude/rules/project-rules.md` | This project's own rules |
| Trilium, under Vibe Coding Projects | The build map, design system, and notes |

## Working with Claude

This project uses the Cartographer plugin (switched on in `.claude/settings.json`). `CLAUDE.md` describes the project, `.claude/rules/project-rules.md` holds its own rules, `docs/bugs.md` lists known bugs, and `docs/roadmap.md` is the plan.

# The Aperture

Rahul Sharma's photography portfolio. A Next.js site hosted on Vercel, with
web-sized photos served from Cloudflare R2 and the originals managed privately
in Immich at home.

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

These files are plain text. Change them, save, and reload:

- `content/about.json`: your name, city, headline, bio, quote, the "Now" line,
  email, and social links.
- `content/sections.json`: the one-line quote under each section name. When
  Immich is connected, the album description replaces this.
- `content/captions.json`: titles and captions for the photos in the
  repository, keyed by file name. When Immich is connected, each photo's
  description replaces this (first line is the title, the rest is the caption).
- `content/curated.json`: which photos go in the intro collage, which is
  featured, and which is "latest". When Immich is connected, the album
  "Portfolio - Intro" picks the collage instead.

After changing `captions.json`, `sections.json`, or `curated.json`, rebuild
the manifest with `npm run photos:local`.

## Publishing photos from Immich

Set up once, in Immich:

1. Create one album per section, named exactly `Portfolio - Overview`,
   `Portfolio - Reflections`, and so on. The order on the site is Overview,
   Reflections, Landscapes, Nature, Abstract, Portraits, Miscellaneous.
2. Give each album a description. It becomes the quote under the section name.
3. Give each photo a description. The first line is its title, any further
   lines are the caption shown in the lightbox.
4. Create an album `Portfolio - Intro` with the nine or more photos you want
   flying in on the landing screen.
5. In Immich, open Account settings, then API keys, and create a key.

Set up once, in Cloudflare:

1. Create an R2 bucket (for example `aperture-photos`) and connect a custom
   domain to it, such as `photos.rahulll.com`.
2. Create an R2 API token with edit access to that bucket.

Then on your home computer:

```bash
cp .env.example .env     # fill in the values
npm run photos:sync
```

Run `npm run photos:sync` whenever you change the albums. It only uploads new
or changed photos, removes photos you took out of the albums, strips all
location data, and writes `manifest.json` to the bucket.

## Deploying on Vercel

1. Import this repository as a new Vercel project. The defaults work.
2. Add one environment variable: `PHOTOS_MANIFEST_URL` set to
   `https://photos.rahulll.com/manifest.json` (your bucket's domain).
3. Deploy. The site re-reads the manifest at most once an hour, so new photos
   appear without another deploy.

Without `PHOTOS_MANIFEST_URL` the site uses the committed `content/photos.json`.

## Checking that it works

```bash
npm run build && npm test
```

This starts the built site, drives it with a real browser (Playwright), checks
the intro, the bento tiles, section switching, hover, the lightbox, and the
phone layout, and saves screenshots in `tests/screenshots/`. The first time on
a new computer run `npx playwright install chromium`.

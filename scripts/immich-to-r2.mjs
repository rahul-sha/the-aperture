// Copies your public albums from Immich to Cloudflare R2.
//
// Run this on the computer that can reach Immich (at home):
//
//   npm run photos:sync
//
// It needs these settings in a .env file next to package.json (see .env.example):
//   IMMICH_URL           e.g. http://immich.local:2283
//   IMMICH_API_KEY       an Immich API key (Account settings, API keys)
//   R2_ACCOUNT_ID        from the Cloudflare dashboard
//   R2_ACCESS_KEY_ID     an R2 API token with edit access to the bucket
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET            e.g. aperture-photos
//   PHOTOS_BASE_URL      the public URL of the bucket, e.g. https://photos.rahulll.com
//
// How it decides what is public:
//   - every album named "Portfolio - <Section>" becomes a section
//   - the album description becomes the section quote (if an album has none,
//     the line for that section in content/sections.json is used)
//   - each photo's description becomes its caption
//   - the city and country Immich worked out for a photo become a short
//     place label; exact coordinates are never published. The manifest also
//     carries photo counts per rough 5 km cell for a future map tile.
//     Photos without GPS simply get no label and are left off the map.
//   - the album "Portfolio - Intro" picks the collage on the landing screen
//   - removing a photo from an album removes it from the site on the next run
//
// Location data is never uploaded: the resize step strips all metadata.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { readExif, resizeBoth, palette, buildManifest, slugify, SECTION_ORDER } from './lib/photo-pipeline.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
// Remembers what was uploaded. SYNC_STATE_DIR lets the Docker image keep it on a volume.
const STATE_DIR = process.env.SYNC_STATE_DIR || ROOT;
const STATE_FILE = path.join(STATE_DIR, '.sync-state.json');

// Minimal .env loader so there is no extra dependency.
async function loadEnv() {
  try {
    const text = await fs.readFile(path.join(ROOT, '.env'), 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // no .env file, rely on the environment
  }
}

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing setting ${name}. Add it to .env, or to the container's environment (see .env.example).`);
    process.exit(1);
  }
  return v;
}

async function immich(pathname, { raw = false, body = null } = {}) {
  const res = await fetch(`${process.env.IMMICH_URL.replace(/\/$/, '')}/api${pathname}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'x-api-key': process.env.IMMICH_API_KEY,
      Accept: raw ? '*/*' : 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Immich ${pathname} failed: ${res.status} ${res.statusText}`);
  return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
}

// Lists the photos in an album. Newer Immich versions leave the photo list
// out of the album response, so fall back to the search endpoint, page by
// page, when it is empty.
async function albumPhotos(album) {
  let assets = (album.assets || []).filter((a) => a.type === 'IMAGE');
  if (assets.length) return assets;
  assets = [];
  for (let page = 1; page < 100; page += 1) {
    const result = await immich('/search/metadata', { body: { albumIds: [album.id], type: 'IMAGE', withExif: true, size: 250, page } });
    const items = result?.assets?.items || [];
    assets.push(...items);
    if (!result?.assets?.nextPage) break;
  }
  return assets;
}

// Snaps a coordinate to a grid so the published map can show "around here"
// without pointing at a street. Cell size defaults to 5 km; set
// LOCATION_GRID_KM in .env to change it (e.g. 2 for a small city, 50 for a
// country-level view).
const CELL = Number(process.env.LOCATION_GRID_KM || 5) / 111; // 1 degree is about 111 km
function addToHeat(heat, lat, lon) {
  const snap = (v) => Number((Math.round(v / CELL) * CELL).toFixed(4));
  const key = `${snap(lat)},${snap(lon)}`;
  heat.set(key, (heat.get(key) || 0) + 1);
}
function heatList(heat) {
  return [...heat.entries()].map(([key, count]) => {
    const [lat, lon] = key.split(',').map(Number);
    return { lat, lon, count };
  }).sort((a, b) => b.count - a.count);
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function main() {
  await loadEnv();
  ['IMMICH_URL', 'IMMICH_API_KEY', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'PHOTOS_BASE_URL'].forEach(need);

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  });
  const bucket = process.env.R2_BUCKET;
  await fs.mkdir(STATE_DIR, { recursive: true });
  const state = await readJson(STATE_FILE, {}); // { assetId: checksum }
  const about = await readJson(path.join(ROOT, 'content', 'about.json'), {});
  const sectionText = await readJson(path.join(ROOT, 'content', 'sections.json'), {});

  // 1. Find the public albums.
  const albums = (await immich('/albums')).filter((a) => /^Portfolio - /i.test(a.albumName));
  if (!albums.length) {
    console.error('No albums named "Portfolio - <Section>" found in Immich.');
    process.exit(1);
  }

  const sections = [];
  let intro = [];
  const keep = new Set(); // object keys that should exist in the bucket after this run
  const heat = new Map(); // coarse cell -> photo count, for a future map tile

  for (const summary of albums) {
    const album = await immich(`/albums/${summary.id}`);
    const name = album.albumName.replace(/^Portfolio - /i, '').trim();
    const assets = await albumPhotos(album);
    process.stdout.write(`Album "${album.albumName}": ${assets.length} photo(s)\n`);

    if (name.toLowerCase() === 'intro') {
      intro = assets.map((a) => a.id);
      continue;
    }

    const slug = slugify(name);
    const photos = [];
    for (const asset of assets) {
      const largeKey = `${slug}/${asset.id}.jpg`;
      const thumbKey = `${slug}/thumbs/${asset.id}.jpg`;
      keep.add(largeKey);
      keep.add(thumbKey);

      const info = asset.exifInfo || {};
      let w = info.exifImageWidth;
      let h = info.exifImageHeight;
      let exif = {
        camera: info.model ? (info.make && !info.model.startsWith(info.make) ? `${info.make} ${info.model}` : info.model) : null,
        lens: info.lensModel || null,
        aperture: info.fNumber ? `f/${Number(info.fNumber.toFixed(1))}` : null,
        shutter: info.exposureTime ? `${info.exposureTime} s` : null,
        iso: info.iso ? `ISO ${info.iso}` : null,
        focal: info.focalLength ? `${Math.round(info.focalLength)} mm` : null,
      };
      let takenAt = info.dateTimeOriginal || asset.fileCreatedAt || null;
      const place = [info.city, info.country].filter(Boolean).join(', ') || null;
      if (Number.isFinite(info.latitude) && Number.isFinite(info.longitude)) addToHeat(heat, info.latitude, info.longitude);

      // State is kept per section copy, so a photo that sits in several
      // albums is uploaded into each section folder.
      const changed = state[largeKey] !== asset.checksum;
      if (changed) {
        process.stdout.write(`Uploading ${slug}/${asset.originalFileName}\n`);
        const original = await immich(`/assets/${asset.id}/original`, { raw: true });
        const fromFile = await readExif(original);
        exif = { camera: exif.camera || fromFile.camera, lens: exif.lens || fromFile.lens, aperture: exif.aperture || fromFile.aperture, shutter: fromFile.shutter || exif.shutter, iso: exif.iso || fromFile.iso, focal: exif.focal || fromFile.focal };
        takenAt = takenAt || fromFile.takenAt;
        const out = await resizeBoth(original);
        w = out.w;
        h = out.h;
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: largeKey, Body: out.large, ContentType: 'image/jpeg', CacheControl: 'public, max-age=31536000, immutable' }));
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: thumbKey, Body: out.thumb, ContentType: 'image/jpeg', CacheControl: 'public, max-age=31536000, immutable' }));
        state[largeKey] = asset.checksum;
        state[`${asset.id}:size`] = [w, h];
        await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
      } else if (state[`${asset.id}:size`]) {
        [w, h] = state[`${asset.id}:size`];
      }

      photos.push({
        id: asset.id,
        section: slug,
        w,
        h,
        title: (info.description || '').split('\n')[0].trim() || asset.originalFileName.replace(/\.[^.]+$/, ''),
        caption: (info.description || '').split('\n').slice(1).join('\n').trim(),
        place,
        takenAt,
        exif,
      });
    }
    photos.sort((a, b) => String(b.takenAt).localeCompare(String(a.takenAt)));
    if (!photos.length) {
      process.stdout.write(`Skipping "${album.albumName}" because it has no photos.\n`);
      continue;
    }
    sections.push({ slug, name, quote: (album.description || '').trim() || sectionText[name] || '', photos });
  }

  sections.sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.name);
    const bi = SECTION_ORDER.indexOf(b.name);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // 2. Remove photos that are no longer in any public album.
  const existing = [];
  let token;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    (page.Contents || []).forEach((o) => existing.push(o.Key));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  const stale = existing.filter((k) => k.endsWith('.jpg') && !keep.has(k));
  for (let i = 0; i < stale.length; i += 1000) {
    await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: stale.slice(i, i + 1000).map((Key) => ({ Key })) } }));
  }
  if (stale.length) process.stdout.write(`Removed ${stale.length} unpublished file(s).\n`);

  // 3. Write the manifest the site reads.
  const all = sections.flatMap((s) => s.photos);
  if (!all.length) {
    console.error('No photos found in any "Portfolio - <Section>" album. Add photos to the albums in Immich, then run the sync again.');
    process.exit(1);
  }
  const byId = Object.fromEntries(all.map((p) => [p.id, p]));
  intro = intro.filter((id) => byId[id]);
  if (intro.length < 9) {
    for (const s of sections) for (const p of s.photos) if (intro.length < 9 && !intro.includes(p.id)) intro.push(p.id);
  }
  const overview = sections.find((s) => s.slug === 'overview') || sections[0];
  const featured = overview.photos[0].id;
  const latest = all.filter((p) => p.takenAt).sort((a, b) => b.takenAt.localeCompare(a.takenAt))[0]?.id || all[0].id;
  const latestBuffer = await immich(`/assets/${latest}/thumbnail?size=preview`, { raw: true });
  const latestPalette = await palette(latestBuffer);

  const manifest = buildManifest({ base: process.env.PHOTOS_BASE_URL.replace(/\/$/, ''), about, sections, intro, featured, latest, latestPalette, heat: heatList(heat) });
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: 'manifest.json', Body: JSON.stringify(manifest), ContentType: 'application/json', CacheControl: 'public, max-age=300' }));
  await fs.writeFile(path.join(STATE_DIR === ROOT ? path.join(ROOT, 'content') : STATE_DIR, 'photos.json'), JSON.stringify(manifest, null, 2));
  process.stdout.write(`Done: ${all.length} photos in ${sections.length} sections. Manifest at ${process.env.PHOTOS_BASE_URL}/manifest.json\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

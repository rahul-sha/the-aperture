// Builds the site's photo manifest from the photos already in this repository
// (assets/zz_categorised-photos). This is the "no Immich yet" path, so the
// site can be built and previewed straight away.
//
//   npm run photos:local
//
// Output:
//   public/photos/<section>/<id>.jpg          web-sized copy
//   public/photos/<section>/thumbs/<id>.jpg   thumbnail
//   content/photos.json                       the manifest the site reads
//
// Titles and captions come from content/captions.json, keyed by file name.
// Anything missing there gets a title made from the file name.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { readExif, resizeBoth, palette, buildManifest, slugify, titleFromFilename, SECTION_ORDER } from './lib/photo-pipeline.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SRC = path.join(ROOT, 'assets', 'zz_categorised-photos');
const OUT = path.join(ROOT, 'public', 'photos');
const CONTENT = path.join(ROOT, 'content');

// Folder names in the repo differ slightly from the section names on the site.
const FOLDER_TO_SECTION = { 'Night-Reflections': 'Reflections' };

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function main() {
  const captions = await readJson(path.join(CONTENT, 'captions.json'), {});
  const sectionText = await readJson(path.join(CONTENT, 'sections.json'), {});
  const about = await readJson(path.join(CONTENT, 'about.json'), {});
  const curated = await readJson(path.join(CONTENT, 'curated.json'), {});

  const folders = (await fs.readdir(SRC, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  const sections = [];

  for (const folder of folders) {
    const name = FOLDER_TO_SECTION[folder] || folder;
    const slug = slugify(name);
    const files = (await fs.readdir(path.join(SRC, folder))).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
    await fs.mkdir(path.join(OUT, slug, 'thumbs'), { recursive: true });
    const photos = [];
    for (const file of files) {
      const id = slugify(file.replace(/\.[^.]+$/, ''));
      const buffer = await fs.readFile(path.join(SRC, folder, file));
      const exif = await readExif(buffer);
      const { large, thumb, w, h } = await resizeBoth(buffer);
      await fs.writeFile(path.join(OUT, slug, `${id}.jpg`), large);
      await fs.writeFile(path.join(OUT, slug, 'thumbs', `${id}.jpg`), thumb);
      const text = captions[file] || {};
      photos.push({
        id,
        section: slug,
        w,
        h,
        title: text.title || titleFromFilename(file),
        caption: text.caption || '',
        takenAt: exif.takenAt,
        exif: { camera: exif.camera, lens: exif.lens, aperture: exif.aperture, shutter: exif.shutter, iso: exif.iso, focal: exif.focal },
      });
      process.stdout.write(`${slug}/${id}.jpg ${w}x${h}\n`);
    }
    sections.push({ slug, name, quote: sectionText[name] || '', photos });
  }

  sections.sort((a, b) => SECTION_ORDER.indexOf(a.name) - SECTION_ORDER.indexOf(b.name));
  const all = sections.flatMap((s) => s.photos);
  const byId = Object.fromEntries(all.map((p) => [p.id, p]));

  // Intro collage: curated list if present, otherwise a spread across sections.
  let intro = (curated.intro || []).filter((id) => byId[id]);
  if (intro.length < 9) {
    const spread = [];
    for (let i = 0; spread.length < 9 && i < 6; i += 1) {
      for (const s of sections) if (s.photos[i] && spread.length < 9) spread.push(s.photos[i].id);
    }
    intro = spread;
  }
  const featured = byId[curated.featured] ? curated.featured : sections[0].photos[0].id;
  const dated = all.filter((p) => p.takenAt).sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  const latest = byId[curated.latest] ? curated.latest : (dated[0] || all[all.length - 1]).id;
  const latestBuffer = await fs.readFile(path.join(OUT, byId[latest].section, `${latest}.jpg`));
  const latestPalette = await palette(latestBuffer);

  const manifest = buildManifest({ base: '/photos', about, sections, intro, featured, latest, latestPalette });
  await fs.mkdir(CONTENT, { recursive: true });
  await fs.writeFile(path.join(CONTENT, 'photos.json'), JSON.stringify(manifest, null, 2));
  process.stdout.write(`\nWrote content/photos.json with ${all.length} photos in ${sections.length} sections.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

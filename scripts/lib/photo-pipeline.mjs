// Shared photo processing used by both the local manifest builder and the
// Immich to R2 sync script.
//
// Given an original photo it produces:
//   - a web-sized JPEG (longest side 1600px) with all metadata stripped,
//     so no location data ever leaves your computer
//   - a small thumbnail (longest side 560px) for the collage and section cards
//   - the handful of camera settings the site shows (camera, lens, aperture,
//     shutter speed, ISO, focal length, date taken)
//   - a five colour palette, used by the "Latest" tile

import sharp from 'sharp';
import exifReader from 'exif-reader';

export const LARGE_EDGE = 1600;
export const THUMB_EDGE = 560;

// Section order on the site. Albums in Immich are named "Portfolio - <Name>".
export const SECTION_ORDER = ['Overview', 'Reflections', 'Landscapes', 'Nature', 'Abstract', 'Portraits', 'Miscellaneous'];

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Turns a file name like "IMG_2196.jpg" into "Img 2196" so nothing is blank.
export function titleFromFilename(file) {
  return file.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fraction(seconds) {
  if (!seconds) return null;
  if (seconds >= 1) return `${Number(seconds.toFixed(1))} s`;
  return `1/${Math.round(1 / seconds)} s`;
}

// Reads the camera settings out of the original file's EXIF block.
// Only these fields are kept. GPS is read and discarded on purpose.
export async function readExif(buffer) {
  const meta = await sharp(buffer).metadata();
  const out = { camera: null, lens: null, aperture: null, shutter: null, iso: null, focal: null, takenAt: null };
  if (!meta.exif) return out;
  let exif;
  try {
    exif = exifReader(meta.exif);
  } catch {
    return out;
  }
  const image = exif.Image || {};
  const photo = exif.Photo || {};
  const make = (image.Make || '').trim();
  const model = (image.Model || '').trim();
  out.camera = model ? (model.startsWith(make) ? model : `${make} ${model}`.trim()) : null;
  out.lens = photo.LensModel ? String(photo.LensModel).trim() : null;
  out.aperture = photo.FNumber ? `f/${Number(photo.FNumber.toFixed(1))}` : null;
  out.shutter = fraction(photo.ExposureTime);
  out.iso = photo.ISOSpeedRatings ? `ISO ${Array.isArray(photo.ISOSpeedRatings) ? photo.ISOSpeedRatings[0] : photo.ISOSpeedRatings}` : null;
  out.focal = photo.FocalLength ? `${Math.round(photo.FocalLength)} mm` : null;
  const when = photo.DateTimeOriginal || image.DateTime;
  if (when instanceof Date && !Number.isNaN(when.getTime())) out.takenAt = when.toISOString();
  return out;
}

// Produces the two resized JPEGs. sharp drops EXIF, GPS and colour profiles
// unless you ask it to keep them, which we never do.
export async function resizeBoth(buffer) {
  const base = sharp(buffer).rotate(); // bake in the orientation flag first
  const large = await base.clone()
    .resize({ width: LARGE_EDGE, height: LARGE_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const thumb = await base.clone()
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  return { large: large.data, w: large.info.width, h: large.info.height, thumb };
}

// A small k-means over a 48px copy of the photo gives five representative
// colours, sorted dark to light.
export async function palette(buffer, count = 5) {
  const { data, info } = await sharp(buffer).rotate().resize(48, 48, { fit: 'cover' }).raw().toBuffer({ resolveWithObject: true });
  const px = [];
  for (let i = 0; i < data.length; i += info.channels) px.push([data[i], data[i + 1], data[i + 2]]);
  let centres = px.filter((_, i) => i % Math.floor(px.length / count) === 0).slice(0, count);
  for (let iter = 0; iter < 12; iter += 1) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let best = 0;
      let bestD = Infinity;
      centres.forEach((c, k) => {
        const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2;
        if (d < bestD) { bestD = d; best = k; }
      });
      sums[best][0] += p[0]; sums[best][1] += p[1]; sums[best][2] += p[2]; sums[best][3] += 1;
    }
    centres = sums.map((s, k) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centres[k]));
  }
  const hex = (n) => Math.round(n).toString(16).padStart(2, '0');
  return centres
    .sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]))
    .map((c) => `#${hex(c[0])}${hex(c[1])}${hex(c[2])}`.toUpperCase());
}

// Counts photos by the hour they were taken (0 to 23) for the clock tile.
export function hourHistogram(photos) {
  const hours = new Array(24).fill(0);
  for (const p of photos) {
    if (!p.takenAt) continue;
    const d = new Date(p.takenAt);
    hours[d.getUTCHours()] += 1;
  }
  return hours;
}

// Assembles the final manifest the site reads.
export function buildManifest({ base, about, sections, intro, featured, latest, latestPalette }) {
  const all = sections.flatMap((s) => s.photos);
  return {
    generatedAt: new Date().toISOString(),
    base,
    about,
    intro,
    featured,
    latest,
    latestPalette,
    hours: hourHistogram(all),
    sections,
  };
}

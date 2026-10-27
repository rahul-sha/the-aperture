import local from '../content/photos.json';
import about from '../content/about.json';

// The site reads one manifest. On Vercel, set PHOTOS_MANIFEST_URL to the copy
// the home sync script uploads to R2; it is re-read at most once an hour.
// Without that setting it uses the committed content/photos.json.
// The About card text always comes from content/about.json in this
// repository, so editing it and deploying is enough; no sync run needed.
export async function getManifest() {
  const url = process.env.PHOTOS_MANIFEST_URL;
  if (!url) return { ...local, about };
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (res.ok) return { ...(await res.json()), about };
  } catch {
    // fall through to the committed copy
  }
  return { ...local, about };
}

export function photoSrc(manifest, photo) {
  return `${manifest.base}/${photo.section}/${photo.id}.jpg`;
}

export function thumbSrc(manifest, photo) {
  return `${manifest.base}/${photo.section}/thumbs/${photo.id}.jpg`;
}

export function findPhoto(manifest, id) {
  for (const s of manifest.sections) for (const p of s.photos) if (p.id === id) return p;
  return null;
}

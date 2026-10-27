import local from '../content/photos.json';

// The site reads one manifest. On Vercel, set PHOTOS_MANIFEST_URL to the copy
// the home sync script uploads to R2; it is re-read at most once an hour.
// Without that setting it uses the committed content/photos.json.
export async function getManifest() {
  const url = process.env.PHOTOS_MANIFEST_URL;
  if (!url) return local;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (res.ok) return await res.json();
  } catch {
    // fall through to the committed copy
  }
  return local;
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

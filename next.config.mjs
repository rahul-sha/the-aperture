// The 3D walk reads photos with WebGL, which only works for images served
// from this site's own address. This passes /photo-files/... straight through
// to the folder on R2 that holds manifest.json, so the browser sees them as
// part of the site.
const manifestUrl = process.env.PHOTOS_MANIFEST_URL;
const photoFolder = manifestUrl ? manifestUrl.slice(0, manifestUrl.lastIndexOf('/')) : null;

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Photos are already resized by the sync script, so Next does not need
    // to optimise them again. This also keeps Vercel's image quota untouched.
    unoptimized: true,
  },
  async rewrites() {
    if (!photoFolder) return [];
    // Only photo files pass through: <section>/<id>.jpg and
    // <section>/thumbs/<id>.jpg. Anything else under /photo-files/ is a 404,
    // so the site cannot be used to fetch other files from the photo host.
    const section = ':section([a-z0-9-]+)';
    const file = ':file([A-Za-z0-9_-]+\\.jpg)';
    return [
      { source: `/photo-files/${section}/${file}`, destination: `${photoFolder}/:section/:file` },
      { source: `/photo-files/${section}/thumbs/${file}`, destination: `${photoFolder}/:section/thumbs/:file` },
    ];
  },
};

export default nextConfig;

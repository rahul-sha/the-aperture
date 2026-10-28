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
    return photoFolder ? [{ source: '/photo-files/:path*', destination: `${photoFolder}/:path*` }] : [];
  },
};

export default nextConfig;

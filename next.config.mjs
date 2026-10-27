/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Photos are already resized by the sync script, so Next does not need
    // to optimise them again. This also keeps Vercel's image quota untouched.
    unoptimized: true,
  },
};

export default nextConfig;

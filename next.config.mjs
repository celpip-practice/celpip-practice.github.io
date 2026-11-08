/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig = {
  // Static export so the site can be served from GitHub Pages or Cloudflare Pages as-is.
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
};

export default nextConfig;

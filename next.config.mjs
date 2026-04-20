/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // served from j4den.com/NCLtest via a Cloudflare Pages reverse proxy.
  // set BASE_PATH="" locally or unset for plain localhost:3000 dev,
  // leave as /NCLtest for the Vercel production deployment.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  experimental: {
    serverComponentsExternalPackages: ["@node-rs/argon2"],
  },
  // y-supabase 0.0.4-alpha imports raw TS from realtime-js/src — force Next
  // to transpile that package so webpack doesn't choke on the ts syntax.
  transpilePackages: ["@supabase/realtime-js"],
};

export default nextConfig;

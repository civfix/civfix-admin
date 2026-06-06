/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static SPA export: emits the shell + JS into ./out with no server runtime. The admin dashboard
  // is a single client-rooted shell (no catch-all routes), so no post-build SPA-fallback step is
  // needed (unlike community-web). One _redirects rule handles the SPA fallback (see public/_redirects).
  output: "export",
  reactStrictMode: true,
  // Required for output: "export" (no Image Optimization server).
  images: {
    unoptimized: true,
  },
  // Trailing slashes make the static export host cleanly on static file servers
  // (each route becomes a directory with an index.html).
  trailingSlash: true,
  // The @civfix/shared package ships ESM + CJS from the workspace; let Next transpile it.
  transpilePackages: ["@civfix/shared"],
}

export default nextConfig

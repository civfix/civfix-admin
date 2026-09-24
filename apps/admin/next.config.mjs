import { execSync } from "node:child_process"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

function resolveCommitSha() {
  const fromCi = process.env.GITHUB_SHA
  if (fromCi) return fromCi
  try {
    return execSync("git rev-parse HEAD", {
      cwd: dirname(fileURLToPath(import.meta.url)),
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim()
  } catch {
    return ""
  }
}

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
  env: {
    NEXT_PUBLIC_COMMIT_SHA: resolveCommitSha(),
  },
  transpilePackages: ["@civfix/shared"],
}

export default nextConfig

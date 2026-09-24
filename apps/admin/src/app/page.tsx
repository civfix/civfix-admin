import { AppShell } from "@/components/shell/app-shell"

// The only route: sections are client-side page state, so the static export emits a single
// out/index.html, served for every path by the SPA fallback in public/_redirects.
export default function HomePage() {
  return <AppShell />
}

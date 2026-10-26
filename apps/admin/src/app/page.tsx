import { AppShell } from "@/components/shell/app-shell"

// The admin's one route: sections are client-side page state, so the static export emits a single
// out/index.html for them, served for every path without a file of its own by the SPA fallback in
// public/_redirects. The developer page (app/dev/) is the only other route.
export default function HomePage() {
  return <AppShell />
}

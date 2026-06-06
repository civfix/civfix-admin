import { AppShell } from "@/components/shell/app-shell"

/**
 * The dashboard is a single client-rooted SPA shell. The static export emits just the HTML shell + JS;
 * the login gate (providers.tsx) and AppShell render entirely on the client, and all data is fetched
 * at runtime. There is exactly one route - section navigation is client-side page state (no Next
 * routes), so the export produces a single out/index.html plus the SPA fallback in public/_redirects.
 */
export default function HomePage() {
  return <AppShell />
}

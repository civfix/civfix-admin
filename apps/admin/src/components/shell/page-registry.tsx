"use client"

import * as React from "react"

import type { PageId } from "@/store/ui-store"

/**
 * The section-page registry. The shell renders the component for the current page from here. Each
 * section is lazily referenced (React.lazy + dynamic import) so the home bundle stays small and each
 * route lives in one file - no shell edits to add or change a page.
 *
 * Each page is implemented at src/features/<section>/<section>-page.tsx with a NAMED export matching the
 * table in EXPECTED_EXPORTS below (e.g. `export function ReportsPage() { ... }`); the lazy import here
 * points at that path + named export.
 *
 * Every section page receives `{ focusId }` (the deep-link target id from the shell), which may be null.
 * The home page receives `{ focusId }` too but ignores it.
 */

export interface SectionPageProps {
  /** The entry id to open/focus inside this section (deep-link target), or null. */
  focusId: string | null
}

type LazyPage = React.LazyExoticComponent<React.ComponentType<SectionPageProps>>

/**
 * Map every page id to its lazily-loaded component. The `.then` picks the NAMED export so section files
 * stay tree-shakeable and consistently named (no default exports).
 */
export const PAGE_REGISTRY: Record<PageId, LazyPage> = {
  home: React.lazy(() =>
    import("@/features/home/home-page").then((m) => ({ default: m.HomePage })),
  ),
  discovery: React.lazy(() =>
    import("@/features/discovery/discovery-page").then((m) => ({ default: m.DiscoveryPage })),
  ),
  reports: React.lazy(() =>
    import("@/features/reports/reports-page").then((m) => ({ default: m.ReportsPage })),
  ),
  events: React.lazy(() =>
    import("@/features/events/events-page").then((m) => ({ default: m.EventsPage })),
  ),
  mail: React.lazy(() => import("@/features/mail/mail-page").then((m) => ({ default: m.MailPage }))),
  users: React.lazy(() =>
    import("@/features/users/users-page").then((m) => ({ default: m.UsersPage })),
  ),
  analytics: React.lazy(() =>
    import("@/features/analytics/analytics-page").then((m) => ({ default: m.AnalyticsPage })),
  ),
  moderation: React.lazy(() =>
    import("@/features/moderation/moderation-page").then((m) => ({ default: m.ModerationPage })),
  ),
  government: React.lazy(() =>
    import("@/features/government/government-page").then((m) => ({ default: m.GovernmentPage })),
  ),
}

/**
 * The named export each section file MUST provide (this object is also the single source of truth
 * referenced by 04-dashboard-scaffold.md).
 */
export const EXPECTED_EXPORTS: Record<PageId, string> = {
  home: "HomePage",
  discovery: "DiscoveryPage",
  reports: "ReportsPage",
  events: "EventsPage",
  mail: "MailPage",
  users: "UsersPage",
  analytics: "AnalyticsPage",
  moderation: "ModerationPage",
  government: "GovernmentPage",
}

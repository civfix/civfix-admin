"use client"

import * as React from "react"

import type { PageId } from "@/store/ui-store"

export interface SectionPageProps {
  focusId: string | null
}

type LazyPage = React.LazyExoticComponent<React.ComponentType<SectionPageProps>>

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
  moderation: React.lazy(() =>
    import("@/features/moderation/moderation-page").then((m) => ({ default: m.ModerationPage })),
  ),
  analytics: React.lazy(() =>
    import("@/features/analytics/analytics-page").then((m) => ({ default: m.AnalyticsPage })),
  ),
  orgs: React.lazy(() => import("@/features/orgs/orgs-page").then((m) => ({ default: m.OrgsPage }))),
  hosts: React.lazy(() =>
    import("@/features/hosts/hosts-page").then((m) => ({ default: m.HostsPage })),
  ),
  pages: React.lazy(() =>
    import("@/features/pages/pages-page").then((m) => ({ default: m.PagesPage })),
  ),
}

export const EXPECTED_EXPORTS: Record<PageId, string> = {
  home: "HomePage",
  discovery: "DiscoveryPage",
  reports: "ReportsPage",
  events: "EventsPage",
  mail: "MailPage",
  users: "UsersPage",
  moderation: "ModerationPage",
  analytics: "AnalyticsPage",
  orgs: "OrgsPage",
  hosts: "HostsPage",
  pages: "PagesPage",
}

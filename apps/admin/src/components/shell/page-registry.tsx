"use client"

import * as React from "react"

import type { PageId } from "@/store/ui-store"

export interface SectionPageProps {
  focusId: string | null
}

type SectionComponent = React.ComponentType<SectionPageProps>
type LazyPage = React.LazyExoticComponent<SectionComponent>

interface SectionModule {
  load: () => Promise<Record<string, unknown>>
  exportName: string
}

// Ties each loader to the name of its page export, and type-checks that export as a section page.
function sectionModule<K extends string, M extends Record<K, SectionComponent>>(
  load: () => Promise<M>,
  exportName: K,
): SectionModule {
  return { load, exportName }
}

const SECTION_MODULES: Record<PageId, SectionModule> = {
  home: sectionModule(() => import("@/features/home/home-page"), "HomePage"),
  discovery: sectionModule(() => import("@/features/discovery/discovery-page"), "DiscoveryPage"),
  reports: sectionModule(() => import("@/features/reports/reports-page"), "ReportsPage"),
  events: sectionModule(() => import("@/features/events/events-page"), "EventsPage"),
  mail: sectionModule(() => import("@/features/mail/mail-page"), "MailPage"),
  users: sectionModule(() => import("@/features/users/users-page"), "UsersPage"),
  moderation: sectionModule(() => import("@/features/moderation/moderation-page"), "ModerationPage"),
  analytics: sectionModule(() => import("@/features/analytics/analytics-page"), "AnalyticsPage"),
  orgs: sectionModule(() => import("@/features/orgs/orgs-page"), "OrgsPage"),
  hosts: sectionModule(() => import("@/features/hosts/hosts-page"), "HostsPage"),
  pages: sectionModule(() => import("@/features/pages/pages-page"), "PagesPage"),
}

function mapSections<T>(fn: (section: SectionModule) => T): Record<PageId, T> {
  return Object.fromEntries(
    Object.entries(SECTION_MODULES).map(([page, section]) => [page, fn(section)]),
  ) as Record<PageId, T>
}

export const PAGE_REGISTRY: Record<PageId, LazyPage> = mapSections(({ load, exportName }) =>
  React.lazy(() => load().then((m) => ({ default: m[exportName] as SectionComponent }))),
)

export const EXPECTED_EXPORTS: Record<PageId, string> = mapSections(({ exportName }) => exportName)

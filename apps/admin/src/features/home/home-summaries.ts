import type { ReactNode } from "react"
import type { HomeSummaryResponse } from "@civfix/shared"

import type { Hue } from "@/features/analytics/analytics-charts"
import {
  getMailPreviewPresentation,
  getModerationPreviewPresentation,
} from "@/features/home/home-preview-presentation"
import type { PageId } from "@/store/ui-store"

export interface SectionStat {
  k: string
  v: ReactNode
  tone?: "warn" | "alert" | null
}

export interface SectionMetric {
  k: string
  v: ReactNode
}

export interface SectionSummary {
  page: PageId
  label: string
  hue: Hue
  /** Null when no trustworthy server-side total exists for this section; the tile then leads with `unit`. */
  lead: number | null
  unit: string
  blurb?: string
  stats: SectionStat[]
  cta: string
  spark?: number[]
  metrics?: SectionMetric[]
}

export interface HomeSections {
  discovery: SectionSummary
  reports: SectionSummary
  events: SectionSummary
  mail: SectionSummary
  users: SectionSummary
  analytics: SectionSummary
}

const NO_COUNT = { lead: null, unit: "" } as const

function counted(lead: number | undefined, unit: string): Pick<SectionSummary, "lead" | "unit"> {
  return lead === undefined ? NO_COUNT : { lead, unit }
}

export function buildSections(data: HomeSummaryResponse | undefined): HomeSections {
  return {
    discovery: {
      page: "discovery",
      label: "Jurisdictions",
      hue: "slate",
      ...counted(data?.discovery.queue, "jurisdictions in queue"),
      blurb:
        "Jurisdictions with reports waiting on routing setup. Work the queue so neighbors' reports reach the right city department.",
      stats: [
        { k: "Reports waiting", v: data?.discovery.reportsWaiting },
        { k: "Over SLA", v: data?.discovery.overSla, tone: (data?.discovery.overSla ?? 0) > 0 ? "warn" : null },
      ],
      cta: "Open",
    },
    reports: {
      page: "reports",
      label: "Reports",
      hue: "lilac",
      ...counted(data?.reports.flagged, "reports flagged"),
      blurb:
        "Every report neighbors submit, routed to the right city department. Track status and close the loop.",
      stats: [
        { k: "In progress", v: data?.reports.inProgress },
        { k: "Completed", v: data?.reports.completed },
      ],
      cta: "Open reports",
    },
    events: {
      page: "events",
      label: "Events",
      hue: "sun",
      ...counted(data?.events.upcoming, "upcoming events"),
      blurb:
        "Community cleanups neighbors organize. Track turnout, keep them legit, and message attendees.",
      stats: [
        { k: "Live now", v: data?.events.live },
        { k: "Attending", v: data?.events.attending },
      ],
      cta: "Open events",
    },
    mail: {
      page: "mail",
      label: "Mail",
      hue: "sky",
      ...counted(data?.mail.unread, "unread messages"),
      blurb:
        "Two-way mail with municipal contacts: outbound routing and the replies that come back.",
      stats: [
        { k: "Needs action", v: data?.mail.needsAction, tone: (data?.mail.needsAction ?? 0) > 0 ? "warn" : null },
        { k: "Unread", v: data?.mail.unread },
      ],
      cta: "Open inbox",
    },
    users: {
      page: "users",
      label: "Users",
      hue: "sun",
      ...counted(data?.users.flagged, "accounts flagged"),
      blurb: "Most neighbors never appear here. The queue surfaces the few who need a trust review.",
      stats: [
        { k: "High risk", v: data?.users.highRisk, tone: (data?.users.highRisk ?? 0) > 0 ? "alert" : null },
        { k: "Suspended", v: data?.users.suspended },
      ],
      cta: "Review accounts",
    },
    analytics: {
      page: "analytics",
      label: "Analytics",
      hue: "moss",
      ...counted(data?.analytics.pinsThisMonth, "pins this month"),
      blurb: "The numbers are the proof civfix works: dropped, routed, resolved, cleaned up.",
      stats: [{ k: "Cleanups", v: data?.analytics.cleanups }],
      spark: data?.analytics.pinsByWeek,
      metrics: data && [
        { k: "Resolved", v: `${data.analytics.resolvedPct}%` },
        { k: "Coverage", v: `${data.analytics.coveragePct}%` },
        { k: "Events", v: data.analytics.eventsThisMonth },
        { k: "New users", v: data.analytics.newUsers },
      ],
      cta: "See analytics",
    },
  }
}

export function mailSection(
  base: SectionSummary,
  data: HomeSummaryResponse | undefined,
): SectionSummary {
  const needsAction = data?.mail.needsAction ?? 0
  const inboxUnread = data?.inboxUnread
  const presentation = base.lead === null ? NO_COUNT : getMailPreviewPresentation(base.lead)
  return {
    ...base,
    lead: presentation.lead,
    unit: presentation.unit,
    blurb:
      "Two-way outreach with municipal contacts plus catch-all inbound to *@civfix.org: replies, support requests, and cold mail in one place.",
    cta: "Open mail",
    stats: [
      { k: "Needs action", v: needsAction, tone: needsAction > 0 ? "warn" : null },
      ...(inboxUnread === undefined
        ? []
        : [{ k: "Inbox unread", v: inboxUnread, tone: null } satisfies SectionStat]),
    ],
  }
}

export function moderationPresentation(data: HomeSummaryResponse | undefined) {
  return data ? getModerationPreviewPresentation(data.moderationQueue) : NO_COUNT
}

export function moderationSection(lead: number | null, unit: string): SectionSummary {
  return {
    page: "moderation",
    label: "Moderation",
    hue: "lilac",
    lead,
    unit,
    stats: [],
    cta: "Open moderation",
  }
}

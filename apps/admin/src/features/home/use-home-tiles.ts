"use client"

import * as React from "react"

import { useHomeSummary } from "@/hooks/use-admin-home"
import { useDiscoveryList } from "@/features/discovery/use-discovery"
import { useReportList } from "@/features/reports/use-reports"
import { useEventList } from "@/features/events/use-events"
import { useMailList } from "@/features/mail/use-mail"
import { useInboxList } from "@/features/inbox/use-inbox"
import { useUserList } from "@/features/users/use-users"
import { useModerationList } from "@/features/moderation/use-moderation"
import {
  discoveryRow,
  eventRow,
  mailPreviewRows,
  moderationRow,
  reportRow,
  userRow,
  type PeekItem,
} from "@/features/home/home-preview-rows"
import {
  mailPreviewState,
  moreLabel,
  previewState,
  type PreviewState,
  type TileNoun,
} from "@/features/home/home-preview-state"
import {
  buildSections,
  mailSection,
  moderationPresentation,
  moderationSection,
  type SectionSummary,
} from "@/features/home/home-summaries"

const PREVIEW_ROWS = 2
// One row past the preview tells a tile whether more exist without a count query.
const PREVIEW_FETCH_LIMIT = PREVIEW_ROWS + 1

type PreviewPage = "discovery" | "mail" | "moderation" | "users" | "reports" | "events"

const TILE_NOUN: Record<PreviewPage, TileNoun> = {
  discovery: { one: "city", many: "cities" },
  mail: { one: "message", many: "messages" },
  moderation: { one: "item", many: "items" },
  users: { one: "account", many: "accounts" },
  reports: { one: "report", many: "reports" },
  events: { one: "event", many: "events" },
}

export interface PreviewTileModel {
  cell: string
  feature?: boolean
  summary: SectionSummary
  state: PreviewState
  rows: PeekItem[]
  moreLabel: string | null
}

function previewTile(
  page: PreviewPage,
  summary: SectionSummary,
  state: PreviewState,
  rows: PeekItem[],
  opts?: { feature?: boolean; total?: number },
): PreviewTileModel {
  return {
    cell: `bt-${page}`,
    feature: opts?.feature,
    summary,
    state,
    rows,
    moreLabel: moreLabel(state, rows.length, TILE_NOUN[page], opts?.total),
  }
}

function previewRows<T>(data: { items: T[] } | undefined, toRow: (item: T) => PeekItem): PeekItem[] {
  return (data?.items ?? []).slice(0, PREVIEW_ROWS).map(toRow)
}

// Every list query runs unconditionally and independently of the summary, so one failing source
// never takes down another tile.
export function useHomeTiles() {
  const summaryQuery = useHomeSummary()

  const discoveryQuery = useDiscoveryList({ limit: PREVIEW_FETCH_LIMIT })
  const reportsQuery = useReportList({ limit: PREVIEW_FETCH_LIMIT })
  const eventsQuery = useEventList({ limit: PREVIEW_FETCH_LIMIT })
  const mailQuery = useMailList({ limit: PREVIEW_FETCH_LIMIT })
  const inboxQuery = useInboxList({ status: "all", limit: PREVIEW_FETCH_LIMIT })
  const usersQuery = useUserList({ limit: PREVIEW_FETCH_LIMIT })
  const moderationQuery = useModerationList({ limit: PREVIEW_FETCH_LIMIT })

  const summary = summaryQuery.data
  const sections = React.useMemo(() => buildSections(summary), [summary])
  const mailSummary = React.useMemo(() => mailSection(sections.mail, summary), [sections, summary])
  const moderation = moderationPresentation(summary)
  const moderationSummary = React.useMemo(
    () => moderationSection(moderation.lead, moderation.unit),
    [moderation.lead, moderation.unit],
  )

  const tiles: Record<PreviewPage, PreviewTileModel> = {
    discovery: previewTile(
      "discovery",
      sections.discovery,
      previewState(discoveryQuery, PREVIEW_ROWS),
      previewRows(discoveryQuery.data, discoveryRow),
      { feature: true, total: summary?.discovery.queue },
    ),
    mail: previewTile(
      "mail",
      mailSummary,
      mailPreviewState(mailQuery, inboxQuery, PREVIEW_ROWS),
      mailPreviewRows(mailQuery.data?.items ?? [], inboxQuery.data?.items ?? [], PREVIEW_ROWS),
    ),
    moderation: previewTile(
      "moderation",
      moderationSummary,
      previewState(moderationQuery, PREVIEW_ROWS),
      previewRows(moderationQuery.data, moderationRow),
    ),
    users: previewTile(
      "users",
      sections.users,
      previewState(usersQuery, PREVIEW_ROWS),
      previewRows(usersQuery.data, userRow),
    ),
    reports: previewTile(
      "reports",
      sections.reports,
      previewState(reportsQuery, PREVIEW_ROWS),
      previewRows(reportsQuery.data, reportRow),
    ),
    events: previewTile(
      "events",
      sections.events,
      previewState(eventsQuery, PREVIEW_ROWS),
      previewRows(eventsQuery.data, eventRow),
    ),
  }

  return {
    summaryQuery,
    analytics: summary ? sections.analytics : undefined,
    tiles,
  }
}

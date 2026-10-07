import type {
  AdminBroadcastListItemDTO,
  AdminBroadcastListQuery,
  AdminHostListQuery,
} from "@civfix/shared"

import { MINUTE_MS } from "@/lib/timing"

export const HOST_ACTIVITY_WINDOW_DAYS = 30

const DAY_MS = 24 * 60 * MINUTE_MS

const UNTITLED_EVENT_TITLE = "Untitled event"

export interface HostActivityWindow {
  from: string
}

export function hostActivityWindow(
  now: Date | number = Date.now(),
  windowDays: number = HOST_ACTIVITY_WINDOW_DAYS,
): HostActivityWindow {
  const nowMs = now instanceof Date ? now.getTime() : now
  return { from: new Date(nowMs - windowDays * DAY_MS).toISOString() }
}

export const HOST_FILTERS = ["all", "active", "suspended"] as const
export type HostFilter = (typeof HOST_FILTERS)[number]

function isHostFilter(value: string): value is HostFilter {
  return (HOST_FILTERS as readonly string[]).includes(value)
}

export function hostListParams(
  filter: string,
  search: string,
  windowDays: number = HOST_ACTIVITY_WINDOW_DAYS,
): Pick<AdminHostListQuery, "suspended" | "q" | "windowDays"> {
  const searchTerm = search.trim() || undefined
  if (!isHostFilter(filter) || filter === "all") return { q: searchTerm, windowDays }
  return { suspended: filter === "suspended", q: searchTerm, windowDays }
}

export function hostBroadcastParams(
  hostId: string,
  window: HostActivityWindow,
): AdminBroadcastListQuery {
  return {
    createdBy: hostId,
    kind: "host_broadcast",
    from: window.from,
  }
}

export interface HostEventRef {
  cleanupId: string
  title: string
}

export function eventsFromBroadcasts(
  items: readonly AdminBroadcastListItemDTO[],
): HostEventRef[] {
  const byCleanupId = new Map<string, HostEventRef>()
  for (const item of items) {
    const existing = byCleanupId.get(item.cleanupId)
    const title = item.eventTitle ?? null
    if (existing === undefined) {
      byCleanupId.set(item.cleanupId, { cleanupId: item.cleanupId, title: title ?? UNTITLED_EVENT_TITLE })
      continue
    }
    if (title !== null && existing.title === UNTITLED_EVENT_TITLE) existing.title = title
  }
  return [...byCleanupId.values()]
}

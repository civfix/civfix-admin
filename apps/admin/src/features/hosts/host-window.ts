import type {
  AdminBroadcastListItemDTO,
  AdminBroadcastListQuery,
  AdminHostListQuery,
} from "@civfix/shared"

export const HOST_ACTIVITY_WINDOW_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

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
  const q = search.trim() === "" ? undefined : search.trim()
  if (!isHostFilter(filter) || filter === "all") return { q, windowDays }
  return { suspended: filter === "suspended", q, windowDays }
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
  const byId = new Map<string, HostEventRef>()
  for (const item of items) {
    const existing = byId.get(item.cleanupId)
    const title = item.eventTitle ?? null
    if (existing === undefined) {
      byId.set(item.cleanupId, { cleanupId: item.cleanupId, title: title ?? "Untitled event" })
      continue
    }
    if (title !== null && existing.title === "Untitled event") existing.title = title
  }
  return [...byId.values()]
}

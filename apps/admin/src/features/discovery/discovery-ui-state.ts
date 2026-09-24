import type { JurisdictionLayer, JurisdictionListQuery } from "@civfix/shared"

import { EMPTY_VALUE } from "@/lib/empty-value"

export type JurisdictionFilter = "all" | "attention" | "clear"
export type JurisdictionSort = "pop" | "reports" | "oldest"

export function effectiveJurisdictionSort(
  filter: JurisdictionFilter,
  selectedSort: JurisdictionSort,
): JurisdictionSort {
  return filter === "attention" ? "oldest" : selectedSort
}

export function countDisplay({
  count,
  isLoading,
  isError,
}: {
  count: number | null
  isLoading: boolean
  isError: boolean
}): number | "Loading…" | typeof EMPTY_VALUE {
  if (isLoading) return "Loading…"
  if (isError || count === null) return EMPTY_VALUE
  return count
}

// A deep link comes from a bounced mail thread, a routed report or a gov claim, none of which sit in
// Needs mapping, so it opens on All with the geoid as the search.
export function initialDirectoryState(focusId: string | null): {
  filter: JurisdictionFilter
  query: string
} {
  return focusId ? { filter: "all", query: focusId } : { filter: "attention", query: "" }
}

export function pickSelected<T extends { geoid: string }>(
  items: readonly T[],
  selId: string | null,
  lastSeen: T | null,
): T | null {
  if (selId === null) return null
  return items.find((x) => x.geoid === selId) ?? (lastSeen?.geoid === selId ? lastSeen : null)
}

export type DirectoryQuery = Pick<JurisdictionListQuery, "q" | "filter" | "layer" | "sort">

const SERVER_FILTER: Record<JurisdictionFilter, NonNullable<JurisdictionListQuery["filter"]>> = {
  attention: "needs_mapping",
  clear: "routed",
  all: "all",
}

const SERVER_SORT: Record<JurisdictionSort, NonNullable<JurisdictionListQuery["sort"]>> = {
  pop: "population",
  reports: "reports",
  oldest: "oldest",
}

export function toDirectoryQuery(
  filter: JurisdictionFilter,
  sort: JurisdictionSort,
  layer: "all" | JurisdictionLayer,
  q: string,
): DirectoryQuery {
  return {
    filter: SERVER_FILTER[filter],
    sort: SERVER_SORT[effectiveJurisdictionSort(filter, sort)],
    ...(layer !== "all" ? { layer } : {}),
    ...(q ? { q } : {}),
  }
}

export type CountDisplay = ReturnType<typeof countDisplay>

export function directoryCounts({
  filter,
  total,
  facets,
  needsMapping,
  list,
  loadedCount,
}: {
  filter: JurisdictionFilter
  total: number | null
  facets: { routed: number; unrouted: number } | null
  needsMapping: CountDisplay
  list: { isLoading: boolean; isError: boolean }
  loadedCount: number
}): { chips: Record<JurisdictionFilter, CountDisplay>; header: CountDisplay } {
  const listCount = (count: number | null) => countDisplay({ count, ...list })
  const allTotal = facets ? facets.routed + facets.unrouted : filter === "all" ? total : null
  const listedTotal = filter === "clear" ? facets?.routed : total
  return {
    chips: {
      attention: needsMapping,
      clear: listCount(facets?.routed ?? null),
      all: listCount(allTotal),
    },
    header: filter === "attention" ? needsMapping : listedTotal ?? loadedCount,
  }
}

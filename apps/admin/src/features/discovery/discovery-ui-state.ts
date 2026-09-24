export type JurisdictionFilter = "all" | "attention" | "clear"
export type JurisdictionSort = "pop" | "reports" | "oldest"

export function getJurisdictionSort(
  filter: JurisdictionFilter,
  selectedSort: JurisdictionSort,
): JurisdictionSort {
  return filter === "attention" ? "oldest" : selectedSort
}

export function getCountDisplay({
  count,
  isLoading,
  isError,
}: {
  count: number | null
  isLoading: boolean
  isError: boolean
}): number | "Loading…" | "—" {
  if (isLoading) return "Loading…"
  if (isError || count === null) return "—"
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
  if (selId === null) return items[0] ?? null
  return items.find((x) => x.geoid === selId) ?? (lastSeen?.geoid === selId ? lastSeen : null)
}
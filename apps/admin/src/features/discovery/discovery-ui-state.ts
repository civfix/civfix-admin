export type JurisdictionFilter = "all" | "attention" | "clear"
export type JurisdictionSort = "pop" | "reports" | "oldest"

export function getJurisdictionSort(
  filter: JurisdictionFilter,
  selectedSort: JurisdictionSort,
): JurisdictionSort {
  return filter === "attention" ? "oldest" : selectedSort
}

export function getNeedsMappingCountDisplay({
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

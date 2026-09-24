"use client"

import * as React from "react"
import type { JurisdictionDirectoryDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { useJurisdictionDirectory } from "@/features/discovery/use-discovery"
import {
  directoryCounts,
  getCountDisplay,
  getJurisdictionSort,
  initialDirectoryState,
  pickSelected,
  toDirectoryQuery,
  type CountDisplay,
  type JurisdictionFilter,
  type JurisdictionSort,
} from "@/features/discovery/discovery-ui-state"
import { JurisdictionDetail } from "@/features/discovery/jurisdiction-detail"
import { JurisdictionRow } from "@/features/discovery/jurisdiction-row"
import {
  LAYER_OPTIONS,
  UNMAPPED_GEOID,
  type LayerChoice,
} from "@/features/discovery/jurisdiction-view"
import { UnmappedDetail } from "@/features/discovery/unmapped-detail"
import { SEARCH_DEBOUNCE_MS } from "@/lib/timing"
import type { SectionPageProps } from "@/components/shell/page-registry"

type DirectoryList = ReturnType<typeof useJurisdictionDirectory>

function useDirectoryFilters(focusId: string | null) {
  const [initial] = React.useState(() => initialDirectoryState(focusId))
  const [filter, setFilter] = React.useState<JurisdictionFilter>(initial.filter)
  const [layer, setLayer] = React.useState<LayerChoice>("all")
  const [sort, setSort] = React.useState<JurisdictionSort>("pop")
  const [query, setQuery] = React.useState(initial.query)
  const [debouncedQuery, setDebouncedQuery] = React.useState(initial.query)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])
  React.useEffect(() => {
    if (!focusId) return
    const next = initialDirectoryState(focusId)
    setFilter(next.filter)
    setQuery(next.query)
    setDebouncedQuery(next.query)
  }, [focusId])

  return { filter, setFilter, layer, setLayer, sort, setSort, query, setQuery, debouncedQuery }
}

// Only the first load picks a jurisdiction on the operator's behalf, and a deep-linked one is never
// replaced. A pick that a filter or search leaves out stays open as it was last listed; a pick that
// drops out of the same list after a refetch (a Save & route under Needs mapping) clears, so the pane
// never shows a stale row or jumps to another jurisdiction's save buttons. Decided only on data
// fetched for the current params.
function useJurisdictionSelection({
  focusId,
  items,
  listQuery,
  listKey,
}: {
  focusId: string | null
  items: JurisdictionDirectoryDTO[]
  listQuery: DirectoryList
  listKey: string
}) {
  const [selectedId, setSelectedId] = React.useState<string | null>(focusId)
  const [lastSeen, setLastSeen] = React.useState<JurisdictionDirectoryDTO | null>(null)
  React.useEffect(() => {
    if (focusId) setSelectedId(focusId)
  }, [focusId])

  const selected = pickSelected(items, selectedId, lastSeen)
  React.useEffect(() => {
    if (selected && selected !== lastSeen) setLastSeen(selected)
  }, [selected, lastSeen])

  const [autoPick, setAutoPick] = React.useState(focusId === null)
  const seenIn = React.useRef<{ id: string; list: string } | null>(null)
  React.useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isFetching) return
    if (selectedId === null) {
      if (autoPick && items[0]) setSelectedId(items[0].geoid)
      return
    }
    setAutoPick(false)
    if (items.some((x) => x.geoid === selectedId)) seenIn.current = { id: selectedId, list: listKey }
    else if (seenIn.current?.id === selectedId && seenIn.current.list === listKey) setSelectedId(null)
  }, [listQuery.isSuccess, listQuery.isFetching, items, selectedId, listKey, autoPick])

  const notListed =
    selectedId !== null && selected === null && !listQuery.isLoading && !listQuery.isError
  return { selectedId, setSelectedId, selected, notListed }
}

function DirectoryToolbar({
  filters,
  chips,
}: {
  filters: ReturnType<typeof useDirectoryFilters>
  chips: Record<JurisdictionFilter, CountDisplay>
}) {
  const { filter, setFilter, layer, setLayer, sort, setSort, query, setQuery } = filters
  return (
    <div className="toolbar">
      <FilterChips
        options={[
          { value: "attention", label: "Needs mapping", count: chips.attention },
          { value: "clear", label: "Routed", count: chips.clear },
          { value: "all", label: "All", count: chips.all },
        ]}
        value={filter}
        onChange={(v) => setFilter(v as JurisdictionFilter)}
      />
      <div className="toolbar-spacer" />
      <div className="searchbox">
        <Icons.Search size={14} />
        <input
          type="text"
          aria-label="Search jurisdictions"
          placeholder="Search place or GEOID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="sortbox">
        <span className="sortbox-label">Type</span>
        <select
          value={layer}
          onChange={(e) => setLayer(e.target.value as LayerChoice)}
          aria-label="Filter by jurisdiction type"
        >
          <option value="all">All types</option>
          {LAYER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.plural}
            </option>
          ))}
        </select>
      </div>
      <div className="sortbox">
        <span className="sortbox-label">Sort</span>
        <select
          value={getJurisdictionSort(filter, sort)}
          disabled={filter === "attention"}
          onChange={(e) => setSort(e.target.value as JurisdictionSort)}
          aria-label="Sort jurisdictions"
        >
          <option value="pop">Population</option>
          <option value="reports">Reports waiting</option>
          <option value="oldest">Oldest reports</option>
        </select>
      </div>
    </div>
  )
}

function DirectoryListBody({
  listQuery,
  items,
  selectedGeoid,
  onSelect,
  showOldest,
}: {
  listQuery: DirectoryList
  items: JurisdictionDirectoryDTO[]
  selectedGeoid: string | undefined
  onSelect: (geoid: string) => void
  showOldest: boolean
}) {
  if (listQuery.isLoading) return <LoadingState label="Loading jurisdictions…" />
  if (listQuery.isError) {
    return <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing matches"
        sub="Try a different filter or search."
        icon={<Icons.Search size={20} />}
      />
    )
  }
  return (
    <>
      {items.map((item) => (
        <JurisdictionRow
          key={item.geoid}
          item={item}
          selected={selectedGeoid === item.geoid}
          onClick={() => onSelect(item.geoid)}
          showOldest={showOldest}
        />
      ))}
      {listQuery.hasNextPage && (
        <button
          type="button"
          className="btn"
          style={{ width: "calc(100% - 20px)", margin: "8px 10px" }}
          disabled={listQuery.isFetchingNextPage}
          onClick={() => listQuery.fetchNextPage()}
        >
          {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  )
}

function SelectedJurisdiction({
  selected,
  selectedId,
  notListed,
}: {
  selected: JurisdictionDirectoryDTO | null
  selectedId: string | null
  notListed: boolean
}) {
  if (selected) {
    return selected.geoid === UNMAPPED_GEOID ? (
      <UnmappedDetail key={selected.geoid} dto={selected} />
    ) : (
      <JurisdictionDetail key={selected.geoid} dto={selected} />
    )
  }
  if (notListed) {
    return (
      <EmptyState
        title="Not in this list"
        sub={`No loaded jurisdiction has GEOID ${selectedId}.`}
        icon={<Icons.Search size={20} />}
      />
    )
  }
  return (
    <EmptyState
      title="No jurisdiction selected"
      sub="Pick a place from the list."
      icon={<Icons.Pin size={20} />}
    />
  )
}

export function DiscoveryPage({ focusId }: SectionPageProps) {
  const filters = useDirectoryFilters(focusId)
  const { filter, layer, sort, debouncedQuery } = filters
  const listParams = toDirectoryQuery(filter, sort, layer, debouncedQuery)
  const listQuery = useJurisdictionDirectory(listParams)
  const needsMappingQuery = useJurisdictionDirectory(
    toDirectoryQuery("attention", sort, layer, debouncedQuery),
  )

  const items = React.useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  )
  const firstPage = listQuery.data?.pages[0]
  const counts = directoryCounts({
    filter,
    total: firstPage?.total ?? null,
    facets: firstPage?.facets ?? null,
    needsMapping: getCountDisplay({
      count: needsMappingQuery.data?.pages[0]?.total ?? null,
      isLoading: needsMappingQuery.isLoading,
      isError: needsMappingQuery.isError,
    }),
    list: { isLoading: listQuery.isLoading, isError: listQuery.isError },
    loadedCount: items.length,
  })

  const selection = useJurisdictionSelection({
    focusId,
    items,
    listQuery,
    listKey: JSON.stringify([listParams.filter, listParams.sort, layer, debouncedQuery]),
  })

  return (
    <>
      <PageHead
        title="Jurisdictions"
        subtitle={
          <span>
            Every place reports land in, and who they route to. Map a routing contact for the ones that
            need one, and reports start flowing.
          </span>
        }
      />

      <DirectoryToolbar filters={filters} chips={counts.chips} />

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>
              {typeof counts.header === "number" ? counts.header.toLocaleString() : counts.header}{" "}
              {counts.header === 1 ? "jurisdiction" : "jurisdictions"}
            </h3>
            <div className="spacer" />
            <span className="meta">click a row →</span>
          </div>
          <div className="queue-list">
            <DirectoryListBody
              listQuery={listQuery}
              items={items}
              selectedGeoid={selection.selected?.geoid}
              onSelect={selection.setSelectedId}
              showOldest={filter === "attention"}
            />
          </div>
        </section>

        <section className="card md-detail-card">
          <SelectedJurisdiction
            selected={selection.selected}
            selectedId={selection.selectedId}
            notListed={selection.notListed}
          />
        </section>
      </div>
    </>
  )
}

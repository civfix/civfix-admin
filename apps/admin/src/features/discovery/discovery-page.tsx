"use client"

import * as React from "react"
import type { JurisdictionDirectoryDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { ListCard, ListStates, LoadMoreButton, SearchBox } from "@/components/shared/section-list"
import { useSelection } from "@/hooks/use-selection"
import { useJurisdictionListInfinite } from "@/features/discovery/use-discovery"
import {
  directoryCounts,
  countDisplay,
  effectiveJurisdictionSort,
  initialDirectoryState,
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
import { flatPages } from "@/lib/infinite"
import type { SectionPageProps } from "@/components/shell/page-registry"

type DirectoryList = ReturnType<typeof useJurisdictionListInfinite>

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

const geoidOf = (item: JurisdictionDirectoryDTO) => item.geoid

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
      <SearchBox
        label="Search jurisdictions"
        placeholder="Search place or GEOID…"
        value={query}
        onChange={setQuery}
      />
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
          value={effectiveJurisdictionSort(filter, sort)}
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
  return (
    <ListStates
      query={listQuery}
      loadingLabel="Loading jurisdictions…"
      isEmpty={items.length === 0}
      empty={
        <EmptyState
          title="Nothing matches"
          sub="Try a different filter or search."
          icon={<Icons.Search size={20} />}
        />
      }
    >
      {items.map((item) => (
        <JurisdictionRow
          key={item.geoid}
          item={item}
          selected={selectedGeoid === item.geoid}
          onClick={() => onSelect(item.geoid)}
          showOldest={showOldest}
        />
      ))}
      <LoadMoreButton query={listQuery} className="list-load-more" />
    </ListStates>
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
  const listQuery = useJurisdictionListInfinite(listParams)
  const needsMappingQuery = useJurisdictionListInfinite(
    toDirectoryQuery("attention", sort, layer, debouncedQuery),
  )

  const items = React.useMemo(
    () => flatPages(listQuery.data),
    [listQuery.data],
  )
  const firstPage = listQuery.data?.pages[0]
  const counts = directoryCounts({
    filter,
    total: firstPage?.total ?? null,
    facets: firstPage?.facets ?? null,
    needsMapping: countDisplay({
      count: needsMappingQuery.data?.pages[0]?.total ?? null,
      isLoading: needsMappingQuery.isLoading,
      isError: needsMappingQuery.isError,
    }),
    list: { isLoading: listQuery.isLoading, isError: listQuery.isError },
    loadedCount: items.length,
  })

  // There is no by-id read here, so a pick that a filter or search leaves out stays open as last listed.
  const { selectedId, setSelectedId, selectedItem: selected } = useSelection({
    focusId,
    list: listQuery,
    items,
    getId: geoidOf,
    listKey: JSON.stringify([listParams.filter, listParams.sort, layer, debouncedQuery]),
    keepLastSeen: true,
  })
  const notListed =
    selectedId !== null && selected === null && !listQuery.isLoading && !listQuery.isError

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
        <ListCard
          title={
            <>
              {typeof counts.header === "number" ? counts.header.toLocaleString() : counts.header}{" "}
              {counts.header === 1 ? "jurisdiction" : "jurisdictions"}
            </>
          }
          meta="click a row →"
        >
          <DirectoryListBody
            listQuery={listQuery}
            items={items}
            selectedGeoid={selected?.geoid}
            onSelect={setSelectedId}
            showOldest={filter === "attention"}
          />
        </ListCard>

        <section className="card md-detail-card">
          <SelectedJurisdiction selected={selected} selectedId={selectedId} notListed={notListed} />
        </section>
      </div>
    </>
  )
}

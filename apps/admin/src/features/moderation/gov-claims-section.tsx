"use client"

import * as React from "react"
import type { GovClaimDTO, GovClaimListQuery } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { useDebounced } from "@/hooks/use-debounced"
import { SEARCH_DEBOUNCE_MS } from "@/lib/timing"
import { flatPages } from "@/lib/infinite"
import { GovClaimDetail, GovClaimRow } from "@/features/moderation/gov-claims-views"
import { useGovClaimListInfinite } from "@/features/moderation/use-gov-claims"

type GovClaimFilter = NonNullable<GovClaimListQuery["filter"]>

const GOV_CLAIM_FILTER_OPTIONS: { value: GovClaimFilter; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
]

type GovClaimListQueryResult = ReturnType<typeof useGovClaimListInfinite>

function GovClaimListItems({
  listQuery,
  items,
  selectedId,
  onSelect,
}: {
  listQuery: GovClaimListQueryResult
  items: GovClaimDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (listQuery.isLoading) return <LoadingState label="Loading claims..." />
  if (listQuery.isError) {
    return <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="No claims here"
        sub="Nobody is waiting on government access right now."
        icon={<Icons.Building size={20} />}
      />
    )
  }
  return (
    <>
      {items.map((c) => (
        <GovClaimRow key={c.id} item={c} selected={selectedId === c.id} onSelect={onSelect} />
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

export function GovClaimsSection() {
  const [filter, setFilter] = React.useState<GovClaimFilter>("pending")
  const [query, setQuery] = React.useState("")
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS)
  const listParams: GovClaimListQuery = {
    ...(filter === "all" ? {} : { filter }),
    ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
  }
  const listKey = JSON.stringify(listParams)
  const listQuery = useGovClaimListInfinite(listParams)
  const items = React.useMemo(
    () => flatPages(listQuery.data),
    [listQuery.data],
  )

  // Only the first load picks a claim on the operator's behalf. A pick that a filter or search leaves
  // out stays open (the detail reads it by id); a pick that drops out of the same list after a refetch
  // clears, so the pane never jumps to another claim's live Approve and Reject buttons. A decision
  // clears its claim outright, since the list may still hold it (All) or never did. Decided only on
  // data fetched for the current params.
  const [autoPick, setAutoPick] = React.useState(true)
  const seenIn = React.useRef<{ id: string; list: string } | null>(null)
  React.useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isFetching) return
    if (selectedId === null) {
      if (autoPick && items.length) setSelectedId(items[0]!.id)
      return
    }
    setAutoPick(false)
    if (items.some((x) => x.id === selectedId)) seenIn.current = { id: selectedId, list: listKey }
    else if (seenIn.current?.id === selectedId && seenIn.current.list === listKey) setSelectedId(null)
  }, [listQuery.isSuccess, listQuery.isFetching, items, selectedId, listKey, autoPick])
  const clearIfSelected = (id: string) => setSelectedId((current) => (current === id ? null : current))

  return (
    <>
      <div className="toolbar">
        <FilterChips
          options={GOV_CLAIM_FILTER_OPTIONS}
          value={filter}
          onChange={(v) => setFilter(v as GovClaimFilter)}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            aria-label="Search gov claims"
            placeholder="Search name or organization…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Gov claims</h3>
            <div className="spacer" />
            <span className="meta">{items.length}</span>
          </div>
          <div className="queue-list">
            <GovClaimListItems
              listQuery={listQuery}
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </section>

        <section className="card md-detail-card">
          {selectedId ? (
            <GovClaimDetail key={selectedId} claimId={selectedId} onDecided={clearIfSelected} />
          ) : (
            <EmptyState
              title="No claim selected"
              sub="Pick a claim from the queue."
              icon={<Icons.Building size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

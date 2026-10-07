"use client"

import * as React from "react"
import type { GovClaimListQuery } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { ListCard, ListStates, LoadMoreButton, SearchBox } from "@/components/shared/section-list"
import { useDebounced } from "@/hooks/use-debounced"
import { idOf, useSelection } from "@/hooks/use-selection"
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

export function GovClaimsSection() {
  const [filter, setFilter] = React.useState<GovClaimFilter>("pending")
  const [query, setQuery] = React.useState("")

  const debouncedQuery = useDebounced(query)
  const listParams: GovClaimListQuery = {
    ...(filter === "all" ? {} : { filter }),
    ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
  }
  const listQuery = useGovClaimListInfinite(listParams)
  const items = React.useMemo(
    () => flatPages(listQuery.data),
    [listQuery.data],
  )

  // A decision clears its claim outright, since the list may still hold it (All) or never did.
  const { selectedId, setSelectedId, clearIfSelected } = useSelection({
    focusId: null,
    list: listQuery,
    items,
    getId: idOf,
    listKey: JSON.stringify(listParams),
  })

  return (
    <>
      <div className="toolbar">
        <FilterChips
          options={GOV_CLAIM_FILTER_OPTIONS}
          value={filter}
          onChange={(v) => setFilter(v as GovClaimFilter)}
        />
        <div className="toolbar-spacer" />
        <SearchBox
          label="Search gov claims"
          placeholder="Search name or organization…"
          value={query}
          onChange={setQuery}
        />
      </div>

      <div className="master-detail">
        <ListCard title="Gov claims" meta={items.length}>
          <ListStates
            query={listQuery}
            loadingLabel="Loading claims..."
            isEmpty={items.length === 0}
            empty={
              <EmptyState
                title="No claims here"
                sub="Nobody is waiting on government access right now."
                icon={<Icons.Building size={20} />}
              />
            }
          >
            {items.map((c) => (
              <GovClaimRow key={c.id} item={c} selected={selectedId === c.id} onSelect={setSelectedId} />
            ))}
            <LoadMoreButton query={listQuery} className="list-load-more" />
          </ListStates>
        </ListCard>

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

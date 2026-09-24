"use client"

import * as React from "react"
import type { ModerationListQuery } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { ListCard, ListStates, LoadMoreButton, SearchBox } from "@/components/shared/section-list"
import { useDebounced } from "@/hooks/use-debounced"
import { idOf, useSelection } from "@/hooks/use-selection"
import { SEARCH_DEBOUNCE_MS } from "@/lib/timing"
import { flatPages } from "@/lib/infinite"
import { ModerationDetail } from "@/features/moderation/moderation-detail"
import { ModerationRowMemo } from "@/features/moderation/moderation-row"
import { useModerationListInfinite } from "@/features/moderation/use-moderation"
import type { SectionPageProps } from "@/components/shell/page-registry"

type QueueFilter = "all" | NonNullable<ModerationListQuery["filter"]>

const QUEUE_FILTER_OPTIONS: { value: QueueFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "user_report", label: "User reports" },
  { value: "image", label: "Image" },
  { value: "pattern", label: "Pattern" },
  { value: "appeal", label: "Appeal" },
  { value: "gps", label: "GPS" },
  { value: "duplicate", label: "Duplicate" },
  { value: "high", label: "High" },
]

export function ModerationQueueSection({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<QueueFilter>("all")
  const [query, setQuery] = React.useState("")

  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS)

  const listParams: ModerationListQuery = {
    ...(filter === "all" ? {} : { filter }),
    ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
  }
  const listQuery = useModerationListInfinite(listParams)
  const items = React.useMemo(
    () => flatPages(listQuery.data),
    [listQuery.data],
  )

  // A decision clears its item outright: the detail carries no status, so a resolved item the list
  // never held would otherwise keep live buttons.
  const { selectedId, setSelectedId, clearIfSelected } = useSelection({
    focusId,
    list: listQuery,
    items,
    getId: idOf,
    listKey: JSON.stringify(listParams),
  })

  return (
    <>
      <div className="toolbar">
        <FilterChips
          options={QUEUE_FILTER_OPTIONS}
          value={filter}
          onChange={(v) => setFilter(v as QueueFilter)}
        />
        <div className="toolbar-spacer" />
        <SearchBox
          label="Search the moderation queue"
          placeholder="Search flag, reporter, reason…"
          value={query}
          onChange={setQuery}
        />
      </div>

      <div className="master-detail">
        <ListCard title="Queue" meta={items.length}>
          <ListStates
            query={listQuery}
            loadingLabel="Loading queue..."
            isEmpty={items.length === 0}
            empty={
              <EmptyState
                title="Queue is clear"
                sub="Nothing needs review right now."
                icon={<Icons.Shield size={20} />}
              />
            }
          >
            {items.map((m) => (
              <ModerationRowMemo
                key={m.id}
                item={m}
                selected={selectedId === m.id}
                onSelect={setSelectedId}
              />
            ))}
            <LoadMoreButton query={listQuery} className="list-load-more" />
          </ListStates>
        </ListCard>

        <section className="card md-detail-card">
          {selectedId ? (
            <ModerationDetail key={selectedId} itemId={selectedId} onResolved={clearIfSelected} />
          ) : (
            <EmptyState
              title="No item selected"
              sub="Pick an item from the queue."
              icon={<Icons.Shield size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

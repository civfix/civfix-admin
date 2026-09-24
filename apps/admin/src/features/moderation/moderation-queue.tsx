"use client"

import * as React from "react"
import type { ModerationListItemDTO, ModerationListQuery } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { useDebounced } from "@/hooks/use-debounced"
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

type QueueListQuery = ReturnType<typeof useModerationListInfinite>

function QueueListItems({
  listQuery,
  items,
  selectedId,
  onSelect,
}: {
  listQuery: QueueListQuery
  items: ModerationListItemDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (listQuery.isLoading) return <LoadingState label="Loading queue..." />
  if (listQuery.isError) {
    return <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="Queue is clear"
        sub="Nothing needs review right now."
        icon={<Icons.Shield size={20} />}
      />
    )
  }
  return (
    <>
      {items.map((m) => (
        <ModerationRowMemo key={m.id} item={m} selected={selectedId === m.id} onSelect={onSelect} />
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

export function ModerationQueueSection({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<QueueFilter>("all")
  const [query, setQuery] = React.useState("")
  const [selectedId, setSelectedId] = React.useState<string | null>(focusId)

  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS)

  const listParams: ModerationListQuery = {
    ...(filter === "all" ? {} : { filter }),
    ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
  }
  const listKey = JSON.stringify(listParams)
  const listQuery = useModerationListInfinite(listParams)
  const items = React.useMemo(
    () => flatPages(listQuery.data),
    [listQuery.data],
  )

  React.useEffect(() => {
    if (focusId) setSelectedId(focusId)
  }, [focusId])
  // Only the first load picks an item on the operator's behalf, and a deep-linked item is never
  // replaced. A pick that a filter or search leaves out stays open (the detail reads it by id); a pick
  // that drops out of the same list after a refetch clears, so the pane never jumps to another item's
  // live decision buttons. A decision clears its item outright: the detail carries no status, so a
  // resolved item the list never held would otherwise keep live buttons. Decided only on data fetched
  // for the current params.
  const [autoPick, setAutoPick] = React.useState(focusId === null)
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
          options={QUEUE_FILTER_OPTIONS}
          value={filter}
          onChange={(v) => setFilter(v as QueueFilter)}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            aria-label="Search the moderation queue"
            placeholder="Search flag, reporter, reason…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Queue</h3>
            <div className="spacer" />
            <span className="meta">{items.length}</span>
          </div>
          <div className="queue-list">
            <QueueListItems
              listQuery={listQuery}
              items={items}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </section>

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

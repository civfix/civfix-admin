"use client"

import type { AdminEventListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { EventRow } from "@/features/events/event-row"
import type { useEventListInfinite } from "@/features/events/use-events"

type EventListQuery = ReturnType<typeof useEventListInfinite>

function EventListItems({
  listQuery,
  items,
  selId,
  onSelect,
}: {
  listQuery: EventListQuery
  items: AdminEventListItemDTO[]
  selId: string | null
  onSelect: (id: string) => void
}) {
  if (listQuery.isLoading) return <LoadingState label="Loading events..." />
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
      {items.map((e) => (
        <EventRow
          key={e.id}
          item={e}
          selected={selId === e.id}
          onClick={() => onSelect(e.id)}
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

export function EventListPane({
  listQuery,
  items,
  listCount,
  selId,
  onSelect,
}: {
  listQuery: EventListQuery
  items: AdminEventListItemDTO[]
  listCount: number
  selId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="card md-list">
      <div className="card-head">
        <h3>Events</h3>
        <div className="spacer" />
        <span className="meta">{listCount}</span>
      </div>
      <div className="queue-list">
        <EventListItems listQuery={listQuery} items={items} selId={selId} onSelect={onSelect} />
      </div>
    </section>
  )
}

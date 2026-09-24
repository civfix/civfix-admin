"use client"

import type { AdminEventListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { ListCard, ListStates, LoadMoreButton } from "@/components/shared/section-list"
import { EventRow } from "@/features/events/event-row"
import type { useEventListInfinite } from "@/features/events/use-events"

export function EventListPane({
  listQuery,
  items,
  listCount,
  selId,
  onSelect,
}: {
  listQuery: ReturnType<typeof useEventListInfinite>
  items: AdminEventListItemDTO[]
  listCount: number
  selId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <ListCard title="Events" meta={listCount}>
      <ListStates
        query={listQuery}
        loadingLabel="Loading events..."
        isEmpty={items.length === 0}
        empty={
          <EmptyState
            title="Nothing matches"
            sub="Try a different filter or search."
            icon={<Icons.Search size={20} />}
          />
        }
      >
        {items.map((e) => (
          <EventRow key={e.id} item={e} selected={selId === e.id} onSelect={onSelect} />
        ))}
        <LoadMoreButton query={listQuery} className="list-load-more" />
      </ListStates>
    </ListCard>
  )
}

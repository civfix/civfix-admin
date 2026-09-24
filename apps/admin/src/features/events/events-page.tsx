"use client"

import * as React from "react"
import type { AdminEventCounts } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { useDebounced } from "@/hooks/use-debounced"
import { EVENT_STATUS_VIEW } from "@/lib/event-status"
import { flatPages } from "@/lib/infinite"
import { EventDetail } from "@/features/events/event-detail"
import { EventListPane } from "@/features/events/event-list-pane"
import { useEventListInfinite } from "@/features/events/use-events"
import type { SectionPageProps } from "@/components/shell/page-registry"

type EventFilter = keyof AdminEventCounts

const EMPTY_COUNTS: AdminEventCounts = {
  all: 0,
  upcoming: 0,
  in_progress: 0,
  completed: 0,
  flagged: 0,
}

function filterOptions(counts: AdminEventCounts) {
  return [
    { value: "all", label: "All", count: counts.all },
    { value: "upcoming", label: "Upcoming", count: counts.upcoming },
    {
      value: "in_progress",
      label: EVENT_STATUS_VIEW.in_progress.label,
      count: counts.in_progress,
    },
    { value: "completed", label: EVENT_STATUS_VIEW.completed.label, count: counts.completed },
    { value: "flagged", label: "Flagged", count: counts.flagged },
  ]
}

export function EventsPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<EventFilter>("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const debouncedQuery = useDebounced(query)
  const listParams = {
    filter: filter === "all" ? undefined : filter,
    q: debouncedQuery.trim() || undefined,
  }
  const listQuery = useEventListInfinite(listParams)
  const items = React.useMemo(
    () => flatPages(listQuery.data),
    [listQuery.data],
  )

  const serverCounts: AdminEventCounts | null = listQuery.data?.pages[0]?.counts ?? null
  const counts = serverCounts ?? EMPTY_COUNTS
  const listCount = serverCounts ? serverCounts[filter] : items.length

  // Only the first load picks an event on the operator's behalf, and a deep-linked event is never
  // replaced. A pick that a filter or search leaves out stays open (the detail reads it by id); a pick
  // that drops out of the same list after a refetch (a cancel under the Upcoming chip) clears, so the
  // pane never jumps to another event's live buttons. Decided only on data fetched for the current params.
  const listKey = JSON.stringify(listParams)
  const [autoPick, setAutoPick] = React.useState(focusId === null)
  const seenIn = React.useRef<{ id: string; list: string } | null>(null)
  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isFetching) return
    if (selId === null) {
      if (autoPick && items.length) setSelId(items[0]!.id)
      return
    }
    setAutoPick(false)
    if (items.some((x) => x.id === selId)) seenIn.current = { id: selId, list: listKey }
    else if (seenIn.current?.id === selId && seenIn.current.list === listKey) setSelId(null)
  }, [listQuery.isSuccess, listQuery.isFetching, items, selId, listKey, autoPick])

  return (
    <>
      <PageHead
        title="Events"
        subtitle={
          <span>
            Cleanups and other volunteer events neighbors organize on civfix. Track
            turnout, keep them on the level, and message attendees.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={filterOptions(counts)}
          value={filter}
          onChange={(v) => setFilter(v as EventFilter)}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            placeholder="Search title, place, organizer…"
            aria-label="Search events"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <EventListPane
          listQuery={listQuery}
          items={items}
          listCount={listCount}
          selId={selId}
          onSelect={setSelId}
        />

        <section className="card md-detail-card">
          {selId ? (
            <EventDetail key={selId} eventId={selId} />
          ) : (
            <EmptyState
              title="No event selected"
              sub="Pick an event from the list."
              icon={<Icons.Calendar size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

"use client"

import * as React from "react"
import type { AdminHostListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { useDebounced } from "@/hooks/use-debounced"
import { SEARCH_DEBOUNCE_MS } from "@/lib/timing"
import { HostDetail } from "@/features/hosts/host-detail"
import { HostListPane } from "@/features/hosts/host-list-pane"
import {
  HOST_ACTIVITY_WINDOW_DAYS,
  HOST_FILTERS,
  hostActivityWindow,
  hostListParams,
  type HostActivityWindow,
  type HostFilter,
} from "@/features/hosts/host-window"
import { useAdminHostsInfinite } from "@/features/hosts/use-hosts"
import type { SectionPageProps } from "@/components/shell/page-registry"

const FILTER_LABEL: Record<HostFilter, string> = {
  all: "All",
  active: "Active",
  suspended: "Suspended",
}

const FILTER_OPTIONS = HOST_FILTERS.map((value) => ({ value, label: FILTER_LABEL[value] }))

// Only the first load picks a host on the operator's behalf, and a deep-linked host is never
// replaced. There is no single-host read, so a pick that a filter or search leaves out clears, and so
// does any host that drops out of the same list after a refetch (a suspend under the Active chip): the
// action buttons never land on a host nobody chose. Decided only on data fetched for the current params.
function useHostSelection(
  focusId: string | null,
  listQuery: ReturnType<typeof useAdminHostsInfinite>,
  rows: AdminHostListItemDTO[],
  listKey: string,
) {
  const [selectedId, setSelectedId] = React.useState<string | null>(focusId)
  const [autoPick, setAutoPick] = React.useState(focusId === null)

  React.useEffect(() => {
    if (focusId) setSelectedId(focusId)
  }, [focusId])
  const seenIn = React.useRef<{ id: string; list: string } | null>(null)
  React.useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isFetching) return
    if (selectedId === null) {
      if (autoPick && rows.length) setSelectedId(rows[0]!.host.id)
      return
    }
    setAutoPick(false)
    if (rows.some((row) => row.host.id === selectedId)) seenIn.current = { id: selectedId, list: listKey }
    else if (selectedId !== focusId || (seenIn.current?.id === selectedId && seenIn.current.list === listKey)) {
      setSelectedId(null)
    }
  }, [listQuery.isSuccess, listQuery.isFetching, rows, selectedId, focusId, listKey, autoPick])

  return [selectedId, setSelectedId] as const
}

function HostDetailPane({
  selected,
  missingLink,
  activityWindow,
}: {
  selected: AdminHostListItemDTO | null
  missingLink: boolean
  activityWindow: HostActivityWindow
}) {
  if (selected) {
    return <HostDetail key={selected.host.id} row={selected} activityWindow={activityWindow} />
  }
  if (missingLink) {
    return (
      <EmptyState
        title="That host is not in this window"
        sub="civfix exposes hosts as a list of broadcast senders, not as a single-host read, so a linked host appears only once the loaded window contains them. Switch the chip to All, clear the search, or load more."
        icon={<Icons.Send size={20} />}
      />
    )
  }
  return (
    <EmptyState
      title="No host selected"
      sub="Pick a host from the list."
      icon={<Icons.Send size={20} />}
    />
  )
}

export function HostsPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<HostFilter>("all")
  const [query, setQuery] = React.useState("")

  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS)
  const activityWindow = React.useMemo(() => hostActivityWindow(), [])
  const listParams = React.useMemo(
    () => hostListParams(filter, debouncedQuery),
    [filter, debouncedQuery],
  )
  const listQuery = useAdminHostsInfinite(listParams)
  const rows = React.useMemo(
    () => listQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [listQuery.data],
  )
  const [selectedId, setSelectedId] = useHostSelection(focusId, listQuery, rows, JSON.stringify(listParams))

  const selected = rows.find((row) => row.host.id === selectedId) ?? null
  const missingLink =
    selected === null && selectedId !== null && selectedId === focusId && listQuery.isSuccess

  return (
    <>
      <PageHead
        title="Host messaging"
        subtitle={
          <span>
            Every host who sent a broadcast in the last {HOST_ACTIVITY_WINDOW_DAYS} days, plus every host
            currently suspended, with server-computed delivery counters and their current messaging
            state. Automated lanes
            (confirmations, reminders, thank-yous) are excluded. Suspend a host and every broadcast
            stops immediately.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(value) => setFilter(value as HostFilter)}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            aria-label="Search hosts"
            placeholder="Search host name or handle…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <HostListPane listQuery={listQuery} rows={rows} selectedId={selectedId} onSelect={setSelectedId} />

        <section className="card md-detail-card">
          <HostDetailPane
            selected={selected}
            missingLink={missingLink}
            activityWindow={activityWindow}
          />
        </section>
      </div>
    </>
  )
}

"use client"

import * as React from "react"
import type { AdminReportCounts } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { ReportDetail } from "@/features/reports/report-detail"
import { ReportListPane } from "@/features/reports/report-list-pane"
import { useDebounced } from "@/hooks/use-debounced"
import { flatPages } from "@/lib/infinite"
import { useReport, useReportListInfinite } from "@/features/reports/use-reports"
import type { SectionPageProps } from "@/components/shell/page-registry"

type ReportFilter = "needs_verification" | "in_progress" | "completed" | "flagged" | "all"

const FILTER_COUNT_KEY: Record<ReportFilter, keyof AdminReportCounts> = {
  needs_verification: "needsVerification",
  in_progress: "in_progress",
  completed: "completed",
  flagged: "flagged",
  all: "all",
}

const EMPTY_COUNTS: AdminReportCounts = {
  all: 0,
  submitted: 0,
  in_progress: 0,
  completed: 0,
  flagged: 0,
}

function filterOptions(counts: AdminReportCounts) {
  return [
    {
      value: "needs_verification",
      label: "Needs verification",
      count: counts.needsVerification ?? 0,
    },
    { value: "in_progress", label: "In progress", count: counts.in_progress },
    { value: "completed", label: "Completed", count: counts.completed },
    { value: "flagged", label: "Flagged", count: counts.flagged },
    { value: "all", label: "All", count: counts.all },
  ]
}

export function ReportsPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<ReportFilter>("needs_verification")
  const [query, setQuery] = React.useState("")
  const debouncedQuery = useDebounced(query)
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const listParams = {
    filter: filter === "all" ? undefined : filter,
    q: debouncedQuery.trim() || undefined,
  }
  const listQuery = useReportListInfinite(listParams)
  const items = React.useMemo(
    () => flatPages(listQuery.data),
    [listQuery.data],
  )

  const serverCounts: AdminReportCounts | null = listQuery.data?.pages[0]?.counts ?? null
  const counts = serverCounts ?? EMPTY_COUNTS
  const listCount = serverCounts ? (serverCounts[FILTER_COUNT_KEY[filter]] ?? 0) : items.length

  // Only the first load picks a report on the operator's behalf, and a deep-linked report is never
  // replaced. A pick that a filter or search leaves out stays open, pinned above the list and read by
  // id; a pick that drops out of the same list after a refetch (a verdict under the Needs verification
  // chip) clears, so the pane never jumps to another report's live buttons. A removal clears its report
  // outright, since a removed report no longer loads by id. Decided only on data fetched for the
  // current params.
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
  const clearIfSelected = (id: string) => setSelId((cur) => (cur === id ? null : cur))

  const selInList = selId !== null && items.some((x) => x.id === selId)
  const pinnedQuery = useReport(selInList ? null : selId)
  const pinned = selInList ? null : (pinnedQuery.data ?? null)

  return (
    <>
      <PageHead
        title="Reports"
        subtitle={
          <span>
            Every report neighbors submit, verified and then routed to the right city department. Track
            status, follow up with the city, and close the loop.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={filterOptions(counts)}
          value={filter}
          onChange={(v) => setFilter(v as ReportFilter)}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            placeholder="Search title, place, reporter…"
            aria-label="Search reports"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <ReportListPane
          listQuery={listQuery}
          items={items}
          listCount={listCount}
          selId={selId}
          pinned={pinned}
          pinnedLabel={selId === focusId ? "Linked report" : "Selected report"}
          onSelect={setSelId}
        />

        <section className="card md-detail-card">
          {selId ? (
            <ReportDetail key={selId} reportId={selId} onRemoved={clearIfSelected} />
          ) : (
            <EmptyState
              title="No report selected"
              sub="Pick a report from the list."
              icon={<Icons.FileText size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

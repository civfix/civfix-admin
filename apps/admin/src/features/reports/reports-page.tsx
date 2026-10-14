"use client"

import * as React from "react"
import type { AdminReportCounts } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { SearchBox } from "@/components/shared/section-list"
import { ReportDetail } from "@/features/reports/report-detail"
import { ReportListPane } from "@/features/reports/report-list-pane"
import { useDebounced } from "@/hooks/use-debounced"
import { idOf, useSelection } from "@/hooks/use-selection"
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

  // A removal clears its report outright, since a removed report no longer loads by id.
  const {
    selectedId: selId,
    setSelectedId: setSelId,
    selectedItem: listed,
    clearIfSelected,
  } = useSelection({
    focusId,
    list: listQuery,
    items,
    getId: idOf,
    listKey: JSON.stringify(listParams),
  })

  // A pick the list leaves out is pinned above it, read by id.
  const pinnedQuery = useReport(listed ? null : selId)
  const pinned = listed ? null : (pinnedQuery.data ?? null)

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
        <SearchBox
          label="Search reports"
          placeholder="Search title, place, reporter…"
          value={query}
          onChange={setQuery}
        />
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

"use client"

import type { AdminReportListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { ReportRow } from "@/features/reports/report-row"
import type { useReportListInfinite } from "@/features/reports/use-reports"

type ReportListQuery = ReturnType<typeof useReportListInfinite>

function ReportListItems({
  listQuery,
  items,
  selId,
  onSelect,
}: {
  listQuery: ReportListQuery
  items: AdminReportListItemDTO[]
  selId: string | null
  onSelect: (id: string) => void
}) {
  if (listQuery.isLoading) return <LoadingState label="Loading reports..." />
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
      {items.map((r) => (
        <ReportRow key={r.id} item={r} selected={selId === r.id} onSelect={onSelect} />
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

export function ReportListPane({
  listQuery,
  items,
  listCount,
  selId,
  pinned,
  pinnedLabel,
  onSelect,
}: {
  listQuery: ReportListQuery
  items: AdminReportListItemDTO[]
  listCount: number
  selId: string | null
  pinned: AdminReportListItemDTO | null
  pinnedLabel: string
  onSelect: (id: string) => void
}) {
  return (
    <section className="card md-list">
      <div className="card-head">
        <h3>Reports</h3>
        <div className="spacer" />
        <span className="meta">{listCount}</span>
      </div>
      <div className="queue-list">
        {pinned && (
          <>
            <div className="eyebrow" style={{ padding: "10px 10px 0" }}>
              {pinnedLabel}
            </div>
            <ReportRow item={pinned} selected onSelect={onSelect} />
          </>
        )}
        <ReportListItems listQuery={listQuery} items={items} selId={selId} onSelect={onSelect} />
      </div>
    </section>
  )
}

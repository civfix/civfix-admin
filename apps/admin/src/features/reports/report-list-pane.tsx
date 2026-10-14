"use client"

import type { AdminReportListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { ListCard, ListStates, LoadMoreButton } from "@/components/shared/section-list"
import { ReportRow } from "@/features/reports/report-row"
import type { useReportListInfinite } from "@/features/reports/use-reports"

export function ReportListPane({
  listQuery,
  items,
  listCount,
  selId,
  pinned,
  pinnedLabel,
  onSelect,
}: {
  listQuery: ReturnType<typeof useReportListInfinite>
  items: AdminReportListItemDTO[]
  listCount: number
  selId: string | null
  pinned: AdminReportListItemDTO | null
  pinnedLabel: string
  onSelect: (id: string) => void
}) {
  return (
    <ListCard title="Reports" meta={listCount}>
      {pinned && (
        <>
          <div className="eyebrow" style={{ padding: "10px 10px 0" }}>
            {pinnedLabel}
          </div>
          <ReportRow item={pinned} selected onSelect={onSelect} />
        </>
      )}
      <ListStates
        query={listQuery}
        loadingLabel="Loading reports..."
        isEmpty={items.length === 0}
        empty={
          <EmptyState
            title="Nothing matches"
            sub="Try a different filter or search."
            icon={<Icons.Search size={20} />}
          />
        }
      >
        {items.map((r) => (
          <ReportRow key={r.id} item={r} selected={selId === r.id} onSelect={onSelect} />
        ))}
        <LoadMoreButton query={listQuery} className="list-load-more" />
      </ListStates>
    </ListCard>
  )
}

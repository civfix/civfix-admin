"use client"

import * as React from "react"
import { REPORT_CATEGORY_LABELS, type AdminReportListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { usePristineDismiss } from "@/components/shared/backdrop-dismiss"
import { useModalFocus } from "@/components/shared/modal-focus"
import { useDebounced } from "@/hooks/use-debounced"
import { reportStatusView } from "@/lib/report-status"
import { flatPages } from "@/lib/infinite"
import { useReportListInfinite } from "@/features/reports/use-reports"

type ReportListQuery = ReturnType<typeof useReportListInfinite>

function emptyPickerHint(searching: boolean, hasMore: boolean): string {
  if (searching) return "Try a different search."
  if (hasMore) return "Every report loaded so far is already linked. Load more to see older ones."
  return "Every matching report is already linked."
}

function PickerRow({
  report,
  picked,
  onToggle,
}: {
  report: AdminReportListItemDTO
  picked: boolean
  onToggle: (id: string) => void
}) {
  const view = reportStatusView(report.status)
  return (
    <button
      type="button"
      aria-pressed={picked}
      className={`evt-pick-row ${picked ? "on" : ""}`}
      onClick={() => onToggle(report.id)}
      title={report.title}
    >
      <span className="evt-pick-check" aria-hidden="true">
        {picked && <Icons.Check size={12} />}
      </span>
      <span className="evt-pick-body">
        <span className="evt-pick-title">{report.title}</span>
        <span className="evt-pick-sub">
          <span className={`pill ${view.cls} tight`}>{view.label}</span>
          <span className="evt-linked-cat">{REPORT_CATEGORY_LABELS[report.category]}</span>
          <span className="sep">·</span>
          <span>{report.place}</span>
        </span>
      </span>
    </button>
  )
}

function PickerResults({
  listQuery,
  candidates,
  picked,
  searching,
  onToggle,
}: {
  listQuery: ReportListQuery
  candidates: AdminReportListItemDTO[]
  picked: Set<string>
  searching: boolean
  onToggle: (id: string) => void
}) {
  if (listQuery.isLoading) return <LoadingState label="Loading reports..." />
  if (listQuery.isError) {
    return <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
  }
  if (candidates.length === 0) {
    return (
      <EmptyState
        title="No reports to link"
        sub={emptyPickerHint(searching, listQuery.hasNextPage)}
        icon={<Icons.Search size={20} />}
      />
    )
  }
  return (
    <div className="evt-pick-list">
      {candidates.map((r) => (
        <PickerRow key={r.id} report={r} picked={picked.has(r.id)} onToggle={onToggle} />
      ))}
    </div>
  )
}

export function LinkReportsPicker({
  excludeIds,
  pending,
  onClose,
  onLink,
}: {
  excludeIds: Set<string>
  pending: boolean
  onClose: () => void
  onLink: (reportIds: string[]) => void
}) {
  const [query, setQuery] = React.useState("")
  const debouncedQuery = useDebounced(query).trim()
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set())
  const modalRef = useModalFocus<HTMLDivElement>(true)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const titleId = React.useId()

  // Focused here rather than with autoFocus: autoFocus lands before useModalFocus records the element
  // to restore, so closing would return focus to the dead field instead of the opener.
  React.useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // The search text is cheap to retype, so only a selection makes the picker a draft worth keeping.
  const backdrop = usePristineDismiss(onClose, picked.size === 0)

  const listQuery = useReportListInfinite(
    { q: debouncedQuery || undefined },
    { keepPreviousData: true },
  )
  const candidates = React.useMemo<AdminReportListItemDTO[]>(
    () =>
      flatPages(listQuery.data).filter((r) => !excludeIds.has(r.id)),
    [listQuery.data, excludeIds],
  )

  const toggle = (id: string) => {
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canLink = picked.size > 0 && !pending

  return (
    <div className="modal-overlay" {...backdrop}>
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-head">
          <h3 id={titleId}>Link reports</h3>
          <button className="closebtn" onClick={onClose} aria-label="Close">
            <Icons.X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="evt-pick-search">
            <Icons.Search size={14} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search title, place, reporter…"
              aria-label="Search reports to link"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <PickerResults
            listQuery={listQuery}
            candidates={candidates}
            picked={picked}
            searching={!!debouncedQuery}
            onToggle={toggle}
          />
          {!listQuery.isLoading && !listQuery.isError && listQuery.hasNextPage && (
            <button
              type="button"
              className="btn full"
              disabled={listQuery.isFetchingNextPage}
              onClick={() => listQuery.fetchNextPage()}
            >
              {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
        <div className="modal-foot">
          <span className="compose-from">
            {picked.size > 0 ? `${picked.size} selected` : "Select reports to link"}
          </span>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${canLink ? "primary" : ""}`}
            disabled={!canLink}
            style={!canLink ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
            onClick={() => onLink([...picked])}
          >
            <Icons.Layers size={13} /> Link selected
          </button>
        </div>
      </div>
    </div>
  )
}

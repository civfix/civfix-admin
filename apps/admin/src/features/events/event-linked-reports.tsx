"use client"

import { REPORT_CATEGORY_LABELS, type AdminEventDTO, type LinkedReportRef } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { confirmDialog } from "@/components/shared/dialog"
import { categoryPinSrc } from "@/lib/category"
import { reportStatusView } from "@/lib/report-status"
import type { useUnlinkReport } from "@/features/events/use-events"
import { useNav } from "@/store/ui-store"

function LinkedReportCard({
  report,
  onOpen,
  onUnlink,
  unlinking,
}: {
  report: LinkedReportRef
  onOpen: () => void
  onUnlink?: () => void
  unlinking?: boolean
}) {
  const view = reportStatusView(report.status)
  const card = (
    <button className="evt-linked-card" onClick={onOpen} title={report.title}>
      <span className="evt-linked-thumb" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={report.thumbUrl || categoryPinSrc(report.category)} alt="" />
      </span>
      <span className="evt-linked-body">
        <span className="evt-linked-title">{report.title}</span>
        <span className="evt-linked-sub">
          <span className={`pill ${view.cls} tight`}>{view.label}</span>
          <span className="evt-linked-cat">{REPORT_CATEGORY_LABELS[report.category]}</span>
        </span>
        {report.addr && <span className="evt-linked-addr">{report.addr}</span>}
      </span>
    </button>
  )
  if (!onUnlink) return card
  return (
    <div className="evt-linked-row">
      {card}
      <button
        className="evt-linked-unlink"
        disabled={unlinking}
        onClick={onUnlink}
        title="Unlink this report from the cleanup"
      >
        <Icons.X size={12} /> Remove
      </button>
    </div>
  )
}

export function EventLinkedReports({
  event,
  linking,
  unlinkMutation,
  onOpenPicker,
}: {
  event: AdminEventDTO
  linking: boolean
  unlinkMutation: ReturnType<typeof useUnlinkReport>
  onOpenPicker: () => void
}) {
  const nav = useNav()

  const onUnlink = async (report: LinkedReportRef) => {
    const ok = await confirmDialog({
      title: "Unlink report",
      body: `This unlinks "${report.title}" from this event. The report itself is untouched.`,
      danger: true,
      confirmLabel: "Unlink",
    })
    if (!ok) return
    unlinkMutation.mutate({ id: event.id, reportId: report.id })
  }

  return (
    <div className="sub">
      <div className="sub-head">
        Linked reports
        <button
          className="btn sm ghost"
          style={{ marginLeft: "auto" }}
          disabled={linking}
          onClick={onOpenPicker}
        >
          <Icons.Plus size={12} /> Link reports
        </button>
        <span className="rep-confirms">
          <Icons.Layers size={12} /> {event.linkedReports.length}
        </span>
      </div>
      <div className="sub-body">
        {event.linkedReports.length === 0 ? (
          <EmptyState
            title="No linked reports"
            sub="This cleanup is not yet linked to any reports."
            icon={<Icons.Layers size={20} />}
          />
        ) : (
          <div className="evt-linked-list">
            {event.linkedReports.map((r) => (
              <LinkedReportCard
                key={r.id}
                report={r}
                onOpen={() => nav("reports", r.id)}
                onUnlink={() => void onUnlink(r)}
                unlinking={unlinkMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

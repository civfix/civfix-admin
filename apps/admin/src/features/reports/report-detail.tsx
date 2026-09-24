"use client"

import * as React from "react"
import {
  ADMIN_REPORT_STATUS_LABELS,
  ADMIN_REPORT_STATUS_TRANSITIONS,
  REPORT_CATEGORY_LABELS,
  type AdminReportDTO,
  type AdminReportStatus,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog } from "@/components/shared/dialog"
import { categoryPinSrc } from "@/lib/category"
import { reportStatusView } from "@/lib/report-status"
import { ReportActivity } from "@/features/reports/report-activity"
import { CityMessageCard, RoutedToCard } from "@/features/reports/report-city-cards"
import { ReportDiscussion } from "@/features/reports/report-discussion"
import { shortId } from "@/features/reports/report-id"
import { ReportLinkedEvents } from "@/features/reports/report-linked-events"
import { reportMediaView } from "@/features/reports/report-media"
import { ReportLocation, ReportPhotos } from "@/features/reports/report-media-panels"
import { outreachView, type OutreachView } from "@/features/reports/report-outreach"
import { ReporterCard } from "@/features/reports/report-reporter-card"
import { SendToJurisdictionCard } from "@/features/reports/report-send-card"
import { sendPanelView } from "@/features/reports/send-panel"
import {
  useFlagReport,
  useRemoveReport,
  useReport,
  useSetReportStatus,
} from "@/features/reports/use-reports"

function ReportHead({ report, outreach }: { report: AdminReportDTO; outreach: OutreachView }) {
  const view = reportStatusView(report.status)
  const OutreachIcon = outreach.icon
  return (
    <div className="rep-head">
      <span className="rep-head-pin">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={categoryPinSrc(report.category)} alt="" />
      </span>
      <div className="rep-head-text">
        <div className="crumb" title={report.id}>
          <span className="mono" style={{ color: "var(--ink-3)" }}>
            {report.referenceCode ?? shortId(report.id)}
          </span>{" "}
          · {REPORT_CATEGORY_LABELS[report.category]} · {report.place}
        </div>
        <h2>{report.title}</h2>
      </div>
      {report.flagged && (
        <span className="pill status-flag" style={{ marginLeft: "auto" }}>
          <Icons.Flag size={11} /> Flagged
        </span>
      )}
      <span
        className={`pill ${outreach.cls} tight`}
        style={report.flagged ? undefined : { marginLeft: "auto" }}
        title="Outreach to the jurisdiction"
      >
        <OutreachIcon size={11} /> {outreach.label}
      </span>
      <span className={`pill ${view.cls}`}>{view.label}</span>
    </div>
  )
}

function ReportSummary({ report }: { report: AdminReportDTO }) {
  return (
    <div className="sub">
      <div className="sub-head">
        Report
        <span className="rep-confirms" style={{ marginLeft: "auto" }}>
          <Icons.Users size={12} />{" "}
          {report.confirmations === 1
            ? "1 neighbor confirmed"
            : `${report.confirmations} neighbors confirmed`}
        </span>
      </div>
      <div className="sub-body">
        <p className="rep-desc">{report.desc}</p>
        <div className="rep-loc">
          <span className="rep-loc-item">
            <Icons.Pin size={13} /> {report.address}
          </span>
          <span className="rep-loc-sep">·</span>
          <span className="rep-loc-item">
            <Icons.Clock size={13} /> Submitted {report.submitted.abs}
          </span>
        </div>
      </div>
    </div>
  )
}

function StatusButtons({ report }: { report: AdminReportDTO }) {
  const statusMutation = useSetReportStatus()
  // A status newer than this build arrives unvalidated; offer no transition rather than guess one.
  const statusActions = ADMIN_REPORT_STATUS_TRANSITIONS[report.status] ?? []

  const onStatus = async (status: AdminReportStatus) => {
    if (status === report.status) return
    if (status === "held") {
      const ok = await confirmDialog({
        title: "Move report back?",
        body: "Moving a live report to Under review hides it from the public map.",
        danger: true,
      })
      if (!ok) return
    }
    statusMutation.mutate({ id: report.id, status })
  }

  if (statusActions.length === 0) {
    return (
      <span className="hint">
        No status changes from {ADMIN_REPORT_STATUS_LABELS[report.status] ?? report.status}
      </span>
    )
  }
  return (
    <>
      {statusActions.map((s) => (
        <button
          key={s}
          className="btn sm"
          disabled={statusMutation.isPending}
          onClick={() => onStatus(s)}
        >
          {ADMIN_REPORT_STATUS_LABELS[s]}
        </button>
      ))}
    </>
  )
}

function ReportQuickActions({
  report,
  onRemoved,
}: {
  report: AdminReportDTO
  onRemoved: (id: string) => void
}) {
  const flagMutation = useFlagReport()
  const removeMutation = useRemoveReport()

  const onRemove = async () => {
    const ok = await confirmDialog({
      title: "Remove report",
      body: "This removes the report from the public map and queue.",
      danger: true,
      confirmLabel: "Remove",
    })
    if (!ok) return
    removeMutation.mutate({ id: report.id }, { onSuccess: () => onRemoved(report.id) })
  }

  return (
    <div className="rep-actions">
      <span className="rep-actions-label">Quick status</span>
      <StatusButtons report={report} />
      <div className="spacer" />
      <button
        className={`btn ${report.flagged ? "flag-on" : ""}`}
        disabled={flagMutation.isPending}
        onClick={() => flagMutation.mutate({ id: report.id })}
      >
        <Icons.Flag size={13} /> {report.flagged ? "Flagged" : "Flag"}
      </button>
      <button className="btn danger" disabled={removeMutation.isPending} onClick={onRemove}>
        <Icons.Trash size={13} /> Remove report
      </button>
    </div>
  )
}

export function ReportDetail({
  reportId,
  onRemoved,
}: {
  reportId: string
  onRemoved: (id: string) => void
}) {
  const reportQuery = useReport(reportId)
  const [approvedLocally, setApprovedLocally] = React.useState(false)

  if (reportQuery.isLoading) return <LoadingState label="Loading report..." />
  if (reportQuery.isError) {
    return <ErrorState error={reportQuery.error} onRetry={() => reportQuery.refetch()} />
  }
  const report = reportQuery.data
  if (!report) return null

  const outreach = outreachView(report.outreach.status)
  const panel = sendPanelView(report, approvedLocally)
  const media = reportMediaView(report.media, report.title)

  return (
    <div className="rep-detail">
      <ReportHead report={report} outreach={outreach} />

      <div className="rep-grid">
        <div className="rep-col">
          <ReportSummary report={report} />
          <ReportLocation report={report} media={media} />
          {media.gallery.length > 0 && <ReportPhotos reportId={report.id} media={media} />}
          <ReportActivity timeline={report.timeline} />
          {report.linkedEvents.length > 0 && <ReportLinkedEvents events={report.linkedEvents} />}
          <ReportDiscussion
            reportId={report.id}
            cityDept={report.city.dept}
            hasCityContact={!!report.city.contact}
          />
        </div>

        <div className="rep-col">
          <ReporterCard reporter={report.reporter} />
          <RoutedToCard report={report} outreach={outreach} />
          <SendToJurisdictionCard
            report={report}
            panel={panel}
            onApprovedChange={setApprovedLocally}
          />
          <CityMessageCard report={report} followupBlocked={panel.followupBlocked} />
        </div>
      </div>

      <ReportQuickActions report={report} onRemoved={onRemoved} />
    </div>
  )
}

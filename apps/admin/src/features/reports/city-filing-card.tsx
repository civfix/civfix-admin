"use client"

import * as React from "react"
import type { AdminReportDTO, GetFilingResponse } from "@civfix/contract"
import type { UseQueryResult } from "@tanstack/react-query"

import { Icons } from "@/components/icons"
import { ErrorState, LoadingState } from "@/components/shared/data-states"
import { LightboxSync, openLightbox, type LightboxImage } from "@/components/shared/lightbox"
import { formatPreciseDateTime } from "@/lib/dates"
import {
  FILING_REASON_LABEL,
  FILING_STATUS_LABEL,
  FILING_STATUS_PILL,
  filingRouteLine,
} from "@/features/filings/filing-labels"
import { useFiling, type ReportFiling } from "@/features/filings/use-filings"
import type { SendPanelView } from "@/features/reports/send-panel"
import {
  reportVerdictActions,
  type ReportVerdictControls,
} from "@/features/reports/use-report-verdict-actions"
import { useToast, type ToastTone } from "@/store/ui-store"

type VerdictActions = ReturnType<typeof reportVerdictActions>
type FilingQuery = UseQueryResult<GetFilingResponse>

function copyToClipboard(text: string, copied: string, toast: (text: string, tone?: ToastTone) => void) {
  const copyFailed = () => toast("Couldn't copy. Select the text manually.", "error")
  // The Clipboard API exists only in a secure context; without it nothing is copied.
  if (!navigator.clipboard) {
    copyFailed()
    return
  }
  navigator.clipboard.writeText(text).then(() => toast(copied), copyFailed)
}

function ReporterVerification({ report }: { report: AdminReportDTO }) {
  return (
    <div className="rep-loc" style={{ marginBottom: 8 }}>
      <span className="rep-loc-item">
        <Icons.Shield size={13} /> Reporter:{" "}
        {report.reporterReportVerified ? "report-verified" : "not report-verified"}
      </span>
      {report.verifiedAt && (
        <>
          <span className="rep-loc-sep">·</span>
          <span className="rep-loc-item">
            <Icons.Clock size={13} /> {formatPreciseDateTime(report.verifiedAt)}
          </span>
        </>
      )}
    </div>
  )
}

function RequestNumber({ filing }: { filing: ReportFiling }) {
  const toast = useToast()
  if (filing.caseId === null) return null
  const caseId = filing.caseId
  return (
    <div className="rep-city-contact" style={{ marginTop: 8 }}>
      <Icons.Hash size={12} />
      <span className="mono">{caseId}</span>
      <button
        type="button"
        className="btn sm ghost"
        title="Copy the city's request number"
        onClick={() => copyToClipboard(caseId, "Request number copied", toast)}
      >
        <Icons.Copy size={11} /> Copy
      </button>
      {filing.caseUrl && (
        <a className="btn sm ghost" href={filing.caseUrl} target="_blank" rel="noopener noreferrer">
          <Icons.ExternalLink size={11} /> Open on city site
        </a>
      )}
    </div>
  )
}

function FilingSummary({ filing }: { filing: ReportFiling }) {
  return (
    <>
      <div className="rep-city-contact" style={{ marginTop: 8 }}>
        <span className={`pill tight ${FILING_STATUS_PILL[filing.status]}`}>
          {FILING_STATUS_LABEL[filing.status]}
        </span>
        {filing.attempts > 0 && <span>Attempts: {filing.attempts}</span>}
      </div>
      <RequestNumber filing={filing} />
      {filing.status === "linked_existing" && <div className="hint">Linked to existing city request</div>}
      {filing.reason && (
        <div style={{ marginTop: 8 }}>
          <div>{FILING_REASON_LABEL[filing.reason]}</div>
          {filing.reasonDetail && <div className="sub-caption">{filing.reasonDetail}</div>}
        </div>
      )}
    </>
  )
}

function FilingEvidence({ query, filing }: { query: FilingQuery; filing: ReportFiling }) {
  const loaded = query.data && !query.isPlaceholderData ? query.data.filing.evidence : null
  const screenshots: LightboxImage[] = React.useMemo(
    () =>
      (loaded ?? [])
        .filter((e) => e.kind === "screenshot")
        .map((e) => ({ id: e.id, url: e.url, alt: e.label })),
    [loaded],
  )
  const scripts = (loaded ?? []).filter((e) => e.kind === "script")
  // Evidence links are signed for 15 minutes; an expired one in the lightbox refetches the filing.
  const refresh = () => void query.refetch()
  return (
    <>
      {loaded === null && <LoadingState label="Loading evidence…" />}
      {screenshots.length > 0 && (
        <div className="dsc-msg-media" style={{ marginTop: 8 }}>
          <LightboxSync images={screenshots} />
          {screenshots.map((shot, index) => (
            <button
              key={shot.id}
              type="button"
              className="dsc-msg-thumb dsc-msg-thumb-open"
              title="Expand this screenshot"
              onClick={() => openLightbox(screenshots, index, refresh)}
            >
              <img src={shot.url} alt={shot.alt} loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
      {(scripts.length > 0 || filing.scriptVersion) && (
        <div className="rep-city-contact" style={{ marginTop: 8 }}>
          {scripts.map((script) => (
            <a
              key={script.id}
              className="lnk-inline"
              href={script.url}
              target="_blank"
              rel="noopener noreferrer"
              title={script.label}
            >
              View script
            </a>
          ))}
          {filing.scriptVersion && <span className="mono">script {filing.scriptVersion}</span>}
        </div>
      )}
    </>
  )
}

function FilingArea({ query, filing }: { query: FilingQuery; filing: ReportFiling }) {
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        title="Could not load the city filing"
      />
    )
  }
  return (
    <>
      <FilingSummary filing={filing} />
      <FilingEvidence query={query} filing={filing} />
    </>
  )
}

function VerdictButtons({ panel, actions }: { panel: SendPanelView; actions: VerdictActions }) {
  const rejectBlockedId = React.useId()
  return (
    <>
      <div className="rep-to" style={{ marginTop: 8 }}>
        {!panel.verdictApproved && (
          <button
            className="btn success sm full"
            disabled={actions.verdictPending}
            onClick={actions.approve}
            title="Approve this report's verification and file it with the city"
          >
            <Icons.Check size={12} /> Approve and file
          </button>
        )}
        <button
          className="btn danger sm full"
          disabled={actions.verdictPending || panel.rejectBlocked !== null}
          aria-describedby={panel.rejectBlocked ? rejectBlockedId : undefined}
          onClick={actions.reject}
          title="Reject this report's verification"
        >
          <Icons.X size={12} /> Reject
        </button>
      </div>
      {panel.rejectBlocked && (
        <div id={rejectBlockedId} className="evt-post-hint">
          {panel.rejectBlocked}
        </div>
      )}
    </>
  )
}

export function CityFilingCard({
  report,
  panel,
  controls,
  onApprovedChange,
}: {
  report: AdminReportDTO
  panel: SendPanelView
  controls: ReportVerdictControls
  onApprovedChange: (approved: boolean) => void
}) {
  const reportFiling = report.filing ?? null
  const query = useFiling(reportFiling)
  const filing = query.data?.filing ?? reportFiling
  const actions = reportVerdictActions(controls, report, filing, onApprovedChange)
  const routeLine = filingRouteLine(report.filingRoute)
  return (
    <div className="sub">
      <div className="sub-head">
        City filing
        <span className={`pill tight ${panel.verdictPill.cls}`} style={{ marginLeft: "auto" }}>
          {panel.verdictPill.label}
        </span>
      </div>
      <div className="sub-body">
        <ReporterVerification report={report} />
        {routeLine && (
          <div className="rep-city-contact">
            <Icons.Send size={12} />
            <span>{routeLine}</span>
          </div>
        )}
        {filing && <FilingArea query={query} filing={filing} />}
        <VerdictButtons panel={panel} actions={actions} />
      </div>
    </div>
  )
}

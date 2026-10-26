"use client"

import * as React from "react"
import {
  ErrorCode,
  FILING_CASE_ID_PATTERN,
  FileReportRequestSchema,
  RecordManualFilingRequestSchema,
  isSafeHttpsUrl,
  type AdminReportDTO,
  type GetFilingResponse,
} from "@civfix/contract"
import type { UseQueryResult } from "@tanstack/react-query"

import { Icons } from "@/components/icons"
import { ErrorState, LoadingState } from "@/components/shared/data-states"
import { LightboxSync, openLightbox, type LightboxImage } from "@/components/shared/lightbox"
import { formatPreciseDateTime } from "@/lib/dates"
import { errorMessage } from "@/lib/error-messages"
import { filingActions } from "@/features/filings/filing-actions"
import {
  FILING_REASON_LABEL,
  FILING_STATUS_LABEL,
  FILING_STATUS_PILL,
  filingRouteLine,
} from "@/features/filings/filing-labels"
import {
  useFiling,
  type FilingControls,
  type ManualDraft,
  type ReportFiling,
} from "@/features/filings/use-filings"
import type { SendPanelView } from "@/features/reports/send-panel"
import {
  reportVerdictActions,
  type ReportVerdictControls,
} from "@/features/reports/use-report-verdict-actions"
import { useToast, type ToastTone } from "@/store/ui-store"

const FILE_NOTE_MAX = FileReportRequestSchema.shape.note.unwrap().maxLength ?? undefined
const MANUAL_NOTE_MAX = RecordManualFilingRequestSchema.shape.note.unwrap().maxLength ?? undefined
const NOTE_ROWS = 3
const FILE_CONFLICT = "This report already has an active or open filing"
const CASE_ID_ERROR =
  "Enter the city's request number: up to 64 letters, digits, spaces or . _ # / -, starting with a letter or digit."
const CASE_URL_ERROR = "Enter an https link, or leave it empty."

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

function FieldError({ text }: { text: string | null | undefined }) {
  if (!text) return null
  return (
    <span className="field-error" role="alert">
      <Icons.AlertTriangle size={11} /> {text}
    </span>
  )
}

function FileForm({
  reportId,
  label,
  controls,
}: {
  reportId: string
  label: string
  controls: FilingControls
}) {
  const { file, fileNote, setFileNote, setForm } = controls
  const noteId = React.useId()
  const submit = () => {
    const note = fileNote.trim()
    file.mutate(
      { id: reportId, ...(note ? { note } : {}) },
      {
        onSuccess: () => {
          setForm(null)
          setFileNote("")
        },
      },
    )
  }
  return (
    <div role="group" aria-label={label} style={{ marginTop: 8 }}>
      <label className="lbl" htmlFor={noteId}>
        Note for the city
      </label>
      <textarea
        id={noteId}
        className="rep-followup"
        rows={NOTE_ROWS}
        placeholder="Optional. Added to the report text as a note from CivFix."
        maxLength={FILE_NOTE_MAX}
        value={fileNote}
        onChange={(e) => setFileNote(e.target.value)}
      />
      {file.isError && (
        <FieldError text={errorMessage(file.error, { [ErrorCode.CONFLICT]: FILE_CONFLICT })} />
      )}
      <div className="rep-to" style={{ marginTop: 8 }}>
        <button type="button" className="btn primary full" disabled={controls.busy} onClick={submit}>
          <Icons.Send size={13} /> {label}
        </button>
        <button type="button" className="btn" disabled={controls.busy} onClick={() => setForm(null)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

interface ManualErrors {
  caseId?: string
  caseUrl?: string
}

function validateManual(draft: ManualDraft): ManualErrors {
  const caseUrl = draft.caseUrl.trim()
  return {
    ...(FILING_CASE_ID_PATTERN.test(draft.caseId.trim()) ? {} : { caseId: CASE_ID_ERROR }),
    ...(caseUrl === "" || isSafeHttpsUrl(caseUrl) ? {} : { caseUrl: CASE_URL_ERROR }),
  }
}

function ManualForm({ filing, controls }: { filing: ReportFiling; controls: FilingControls }) {
  const { manual, manualDraft: draft, setManualDraft, setForm } = controls
  const [errors, setErrors] = React.useState<ManualErrors>({})
  const id = React.useId()
  const edit = (patch: Partial<ManualDraft>) => setManualDraft({ ...draft, ...patch })

  const submit = () => {
    const found = validateManual(draft)
    setErrors(found)
    if (found.caseId || found.caseUrl) return
    const caseUrl = draft.caseUrl.trim()
    const note = draft.note.trim()
    manual.mutate(
      {
        id: filing.id,
        caseId: draft.caseId.trim(),
        ...(caseUrl ? { caseUrl } : {}),
        ...(note ? { note } : {}),
      },
      { onSuccess: () => setForm(null) },
    )
  }

  return (
    <div role="group" aria-label="Record manual filing" style={{ marginTop: 8 }}>
      <div className="field">
        <label className="lbl" htmlFor={`${id}-case`}>
          Request number
        </label>
        <input
          id={`${id}-case`}
          type="text"
          value={draft.caseId}
          onChange={(e) => edit({ caseId: e.target.value })}
        />
        <FieldError text={errors.caseId} />
      </div>
      <div className="field">
        <label className="lbl" htmlFor={`${id}-url`}>
          Link on the city site
        </label>
        <input
          id={`${id}-url`}
          type="text"
          inputMode="url"
          placeholder="Optional, https://"
          value={draft.caseUrl}
          onChange={(e) => edit({ caseUrl: e.target.value })}
        />
        <FieldError text={errors.caseUrl} />
      </div>
      <div className="field">
        <label className="lbl" htmlFor={`${id}-note`}>
          Note
        </label>
        <textarea
          id={`${id}-note`}
          className="rep-followup"
          rows={NOTE_ROWS}
          placeholder="Optional"
          maxLength={MANUAL_NOTE_MAX}
          value={draft.note}
          onChange={(e) => edit({ note: e.target.value })}
        />
      </div>
      {manual.isError && <FieldError text={errorMessage(manual.error)} />}
      <div className="rep-to" style={{ marginTop: 8 }}>
        <button type="button" className="btn primary full" disabled={controls.busy} onClick={submit}>
          <Icons.Check size={13} /> Record
        </button>
        <button type="button" className="btn" disabled={controls.busy} onClick={() => setForm(null)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function FilingActions({
  report,
  filing,
  panel,
  controls,
}: {
  report: AdminReportDTO
  filing: ReportFiling | null
  panel: SendPanelView
  controls: FilingControls
}) {
  const toast = useToast()
  const allowed = filingActions(filing, panel)
  const { form, busy } = controls
  const fileLabel = allowed.fileAgain ? "File again" : "File"

  const openFile = () => {
    controls.file.reset()
    controls.setFileNote("")
    controls.setForm("file")
  }
  const openManual = (open: ReportFiling) => {
    controls.manual.reset()
    // The city's request stays the same when it only asked for more information.
    controls.setManualDraft({
      caseId: open.reason === "city_needs_info" ? (open.caseId ?? "") : "",
      caseUrl: "",
      note: "",
    })
    controls.setForm("manual")
  }

  if (form === "file" && (allowed.file || allowed.fileAgain)) {
    return <FileForm reportId={report.id} label={fileLabel} controls={controls} />
  }
  if (form === "manual" && filing && allowed.recordManual) {
    return <ManualForm filing={filing} controls={controls} />
  }
  return (
    <div className="row-flex" style={{ marginTop: 8, flexWrap: "wrap" }}>
      {(allowed.file || allowed.fileAgain) && (
        <button type="button" className="btn sm primary" disabled={busy} onClick={openFile}>
          <Icons.Send size={12} /> {fileLabel}
        </button>
      )}
      {filing && allowed.retry && (
        <button
          type="button"
          className="btn sm"
          disabled={busy}
          onClick={() => controls.retry.mutate({ id: filing.id })}
        >
          Retry
        </button>
      )}
      {filing && allowed.cancel && (
        <button
          type="button"
          className="btn sm"
          disabled={busy}
          onClick={() => controls.cancel.mutate({ id: filing.id })}
        >
          Cancel filing
        </button>
      )}
      {filing && allowed.recordManual && (
        <button type="button" className="btn sm" disabled={busy} onClick={() => openManual(filing)}>
          Record manual filing
        </button>
      )}
      {filing && allowed.copyText && (
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => copyToClipboard(filing.ticketText, "Report text copied", toast)}
        >
          <Icons.Copy size={12} /> Copy report text
        </button>
      )}
    </div>
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
  filingControls,
  onApprovedChange,
}: {
  report: AdminReportDTO
  panel: SendPanelView
  controls: ReportVerdictControls
  filingControls: FilingControls
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
        <FilingActions report={report} filing={filing} panel={panel} controls={filingControls} />
        <VerdictButtons panel={panel} actions={actions} />
      </div>
    </div>
  )
}

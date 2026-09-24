"use client"

import * as React from "react"
import { RouteReportRequestSchema, type AdminReportDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { formatPreciseDateTime } from "@/lib/dates"
import type { SendPanelView } from "@/features/reports/send-panel"
import {
  reportVerdictActions,
  type ReportVerdictControls,
} from "@/features/reports/use-report-verdict-actions"
import { useNav } from "@/store/ui-store"

const ROUTE_NOTE_MAX = RouteReportRequestSchema.shape.note.unwrap().maxLength ?? undefined
const ROUTE_NOTE_ROWS = 3

type VerdictActions = ReturnType<typeof reportVerdictActions>

const NO_ROUTE_HINT = {
  no_jurisdiction:
    "This report's location did not resolve to a jurisdiction. Reports are only forwarded to a contact on file.",
  no_contact:
    "This jurisdiction has no routing contact on file. Reports are only forwarded to a contact on file.",
} as const

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

function RouteUnavailable({
  kind,
  geoid,
}: {
  kind: keyof typeof NO_ROUTE_HINT
  geoid: AdminReportDTO["geoid"]
}) {
  const nav = useNav()
  return (
    <>
      <div className="hint">{NO_ROUTE_HINT[kind]}</div>
      {geoid !== null && (
        <button className="btn full" style={{ marginTop: 8 }} onClick={() => nav("discovery", geoid)}>
          <Icons.Building size={13} /> Set the routing contact in Jurisdictions
        </button>
      )}
    </>
  )
}

function RouteOpener({ panel, onOpen }: { panel: SendPanelView; onOpen: () => void }) {
  const routeBlockedId = React.useId()
  return (
    <>
      <button
        className="btn primary full"
        disabled={panel.routeBlocked !== null}
        aria-describedby={panel.routeBlocked ? routeBlockedId : undefined}
        style={panel.routeBlocked ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
        onClick={onOpen}
      >
        <Icons.Send size={13} /> {panel.routeLabel}
      </button>
      {panel.routeBlocked && (
        <div id={routeBlockedId} className="hint">
          {panel.routeBlocked}
        </div>
      )}
    </>
  )
}

function RouteComposer({
  contact,
  routeLabel,
  actions,
}: {
  contact: AdminReportDTO["city"]["contact"]
  routeLabel: string
  actions: VerdictActions
}) {
  return (
    <>
      <div className="rep-city-contact">
        <Icons.Mail size={12} />
        <span className="mono">{contact}</span>
      </div>
      <textarea
        className="rep-followup"
        style={{ marginTop: 8 }}
        rows={ROUTE_NOTE_ROWS}
        placeholder="Optional note to include in the email packet…"
        aria-label="Note to include in the email"
        maxLength={ROUTE_NOTE_MAX}
        value={actions.routeNote}
        onChange={(e) => actions.setRouteNote(e.target.value)}
      />
      <div className="rep-to" style={{ marginTop: 8 }}>
        <button
          className="btn primary full"
          disabled={actions.routeBusy}
          onClick={actions.sendToJurisdiction}
        >
          <Icons.Send size={13} /> {routeLabel}
        </button>
        <button className="btn" disabled={actions.routeBusy} onClick={actions.closeRoute}>
          Cancel
        </button>
      </div>
    </>
  )
}

function RoutePanel({
  report,
  panel,
  actions,
}: {
  report: AdminReportDTO
  panel: SendPanelView
  actions: VerdictActions
}) {
  const kind = panel.routeAction.kind
  if (kind === "no_contact" || kind === "no_jurisdiction") {
    return <RouteUnavailable kind={kind} geoid={report.geoid} />
  }
  if (!actions.routeOpen) return <RouteOpener panel={panel} onOpen={actions.openRoute} />
  return <RouteComposer contact={report.city.contact} routeLabel={panel.routeLabel} actions={actions} />
}

function VerdictButtons({ panel, actions }: { panel: SendPanelView; actions: VerdictActions }) {
  const rejectBlockedId = React.useId()
  return (
    <>
      <div className="rep-to" style={{ marginTop: 8 }}>
        {panel.canApproveHere && (
          <button
            className="btn success sm full"
            disabled={actions.verdictPending}
            onClick={actions.approve}
            title="Approve this report's verification without sending it to the city"
          >
            <Icons.Check size={12} /> Approve
          </button>
        )}
        <button
          className="btn danger sm full"
          disabled={actions.verdictPending || panel.rejectBlocked !== null}
          aria-describedby={panel.rejectBlocked ? rejectBlockedId : undefined}
          onClick={actions.reject}
          title="Reject this report's verification instead of sending it"
        >
          <Icons.X size={12} /> Reject
        </button>
      </div>
      {panel.rejectBlocked && (
        <div id={rejectBlockedId} className="hint">
          {panel.rejectBlocked}
        </div>
      )}
    </>
  )
}

export function SendToJurisdictionCard({
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
  const actions = reportVerdictActions(controls, report, panel.approvesOnSend, onApprovedChange)
  return (
    <div className="sub">
      <div className="sub-head">
        Send to jurisdiction
        <span className={`pill tight ${panel.verdictPill.cls}`} style={{ marginLeft: "auto" }}>
          {panel.verdictPill.label}
        </span>
      </div>
      <div className="sub-body">
        <ReporterVerification report={report} />
        <RoutePanel report={report} panel={panel} actions={actions} />
        <VerdictButtons panel={panel} actions={actions} />
      </div>
    </div>
  )
}

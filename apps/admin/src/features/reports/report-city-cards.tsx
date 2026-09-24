"use client"

import * as React from "react"
import { SendFollowupRequestSchema, type AdminReportDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import type { OutreachView } from "@/features/reports/report-outreach"
import { useSendReportFollowup } from "@/features/reports/use-reports"
import { useNav } from "@/store/ui-store"

const FOLLOWUP_MAX = SendFollowupRequestSchema.shape.body.maxLength ?? undefined
const FOLLOWUP_ROWS = 3

function CityContactLine({ contact }: { contact: AdminReportDTO["city"]["contact"] }) {
  if (contact) {
    return (
      <div className="rep-city-contact">
        <Icons.Mail size={12} />
        <span className="mono">{contact}</span>
      </div>
    )
  }
  return (
    <div className="rep-city-contact warn">
      <Icons.AlertTriangle size={12} />
      <span>No contact on file. Set one in Jurisdictions.</span>
    </div>
  )
}

function OutreachLine({ report, outreach }: { report: AdminReportDTO; outreach: OutreachView }) {
  const OutreachIcon = outreach.icon
  const showRoutedTo = report.outreach.routedTo && report.outreach.status !== "not_sent"
  return (
    <div className="rep-city-contact" style={{ marginTop: 8 }}>
      <OutreachIcon size={12} />
      <span>
        Outreach: <b>{outreach.label}</b>
        {showRoutedTo && (
          <>
            {" "}
            · <span className="mono">{report.outreach.routedTo}</span>
          </>
        )}
      </span>
    </div>
  )
}

export function RoutedToCard({ report, outreach }: { report: AdminReportDTO; outreach: OutreachView }) {
  const nav = useNav()
  return (
    <div className="sub">
      <div className="sub-head">
        Routed to
        {report.geoid && (
          <button
            className="btn sm ghost"
            style={{ marginLeft: "auto" }}
            onClick={() => nav("discovery", report.geoid)}
            title="Open this jurisdiction in Jurisdictions"
          >
            <Icons.Building size={11} /> Jurisdiction →
          </button>
        )}
      </div>
      <div className="sub-body">
        <div className="rep-city">
          <span className="rep-city-ico">
            <Icons.Building size={15} />
          </span>
          <div>
            <div className="rep-city-dept">{report.city.dept}</div>
            {report.city.dept !== report.place && (
              <div className="rep-city-place">{report.place}</div>
            )}
          </div>
        </div>
        <CityContactLine contact={report.city.contact} />
        <OutreachLine report={report} outreach={outreach} />
        {report.outreach.threadId && (
          <button
            className="btn sm ghost full"
            style={{ marginTop: 6 }}
            onClick={() => nav("mail", report.outreach.threadId)}
            title="Open the jurisdiction conversation in Mail"
          >
            <Icons.MessageSquare size={12} /> View conversation →
          </button>
        )}
      </div>
    </div>
  )
}

export function CityMessageCard({
  report,
  followupBlocked,
}: {
  report: AdminReportDTO
  followupBlocked: string | null
}) {
  const followupMutation = useSendReportFollowup()
  const [followupDraft, setFollowupDraft] = React.useState("")
  const followupBlockedId = React.useId()
  const canSend = followupBlocked === null
  const hasDraft = !!followupDraft.trim()

  const send = () => {
    const body = followupDraft.trim()
    if (!body || !canSend) return
    followupMutation.mutate(
      { id: report.id, to: "city", body },
      { onSuccess: () => setFollowupDraft("") },
    )
  }

  return (
    <div className="sub">
      <div className="sub-head">Message the city</div>
      <div className="sub-body">
        <div className="rep-city-contact">
          <Icons.Building size={12} />
          <span>{report.city.dept}</span>
        </div>
        <textarea
          className="rep-followup"
          style={{ marginTop: 8 }}
          rows={FOLLOWUP_ROWS}
          placeholder={`Message ${report.city.dept}, e.g. nudge for an update…`}
          aria-label="Message to the city"
          maxLength={FOLLOWUP_MAX}
          value={followupDraft}
          onChange={(e) => setFollowupDraft(e.target.value)}
        />
        <button
          className="btn primary full"
          disabled={!hasDraft || !canSend || followupMutation.isPending}
          aria-describedby={followupBlocked ? followupBlockedId : undefined}
          onClick={send}
          style={!hasDraft || !canSend ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
        >
          <Icons.Send size={13} /> Send to city
        </button>
        {followupBlocked && (
          <div id={followupBlockedId} className="hint">
            {followupBlocked}
          </div>
        )}
      </div>
    </div>
  )
}

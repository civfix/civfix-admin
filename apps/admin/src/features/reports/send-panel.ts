import type { AdminReportDTO } from "@civfix/contract"

export type SendPanelReport = Pick<AdminReportDTO, "city" | "outreach" | "verificationVerdict">

const VERDICT_PILL = {
  approved: { cls: "status-ok", label: "Approved" },
  rejected: { cls: "status-flag", label: "Rejected" },
  unreviewed: { cls: "status-new", label: "Not yet reviewed" },
} as const

export interface SendPanelView {
  verdictApproved: boolean
  verdictPill: { cls: string; label: string }
  followupBlocked: string | null
  rejectBlocked: string | null
}

// A local approve outranks the server verdict until the refetch lands, so the panel never offers a
// second approve (or blocks a reject) on a verdict the operator just changed.
export function sendPanelView(report: SendPanelReport, approvedLocally: boolean): SendPanelView {
  const verdictApproved = report.verificationVerdict === "approved" || approvedLocally
  const verdictRejected = report.verificationVerdict === "rejected" && !approvedLocally
  return {
    verdictApproved,
    verdictPill: verdictApproved
      ? VERDICT_PILL.approved
      : verdictRejected
        ? VERDICT_PILL.rejected
        : VERDICT_PILL.unreviewed,
    followupBlocked: !report.city.contact
      ? "No city contact on file"
      : report.outreach.threadId === null
        ? "Send the report to the city first. A follow-up goes on that conversation."
        : null,
    rejectBlocked: verdictRejected ? "This report is already rejected." : null,
  }
}

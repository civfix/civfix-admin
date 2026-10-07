import type { AdminReportDTO } from "@civfix/shared"

import { formatPreciseDateTime } from "@/lib/dates"
import {
  routeActionView,
  routeSendLabel,
  type RoutableReport,
  type RouteAction,
} from "@/features/reports/route-action"

export type SendPanelReport = RoutableReport & Pick<AdminReportDTO, "verificationVerdict">

const VERDICT_PILL = {
  approved: { cls: "status-ok", label: "Approved" },
  rejected: { cls: "status-flag", label: "Rejected" },
  unreviewed: { cls: "status-new", label: "Not yet reviewed" },
} as const

export interface SendPanelView {
  routeAction: RouteAction
  verdictApproved: boolean
  verdictPill: { cls: string; label: string }
  approvesOnSend: boolean
  canApproveHere: boolean
  routeLabel: string
  routeBlocked: string | null
  followupBlocked: string | null
  rejectBlocked: string | null
}

function routeButtonLabel(action: RouteAction, verdictApproved: boolean): string {
  if (action.kind === "already_sent") {
    return action.routedAt ? `Already sent · ${formatPreciseDateTime(action.routedAt)}` : "Already sent"
  }
  if (action.kind === "resend") return "Send again to jurisdiction"
  return routeSendLabel(verdictApproved)
}

// A local approve outranks the server verdict until the refetch lands, so the panel never offers a
// second approve (or blocks a reject) on a verdict the operator just changed.
export function sendPanelView(report: SendPanelReport, approvedLocally: boolean): SendPanelView {
  const routeAction = routeActionView(report)
  const verdictApproved = report.verificationVerdict === "approved" || approvedLocally
  const approvesOnSend = routeAction.kind === "send" && !verdictApproved
  return {
    routeAction,
    verdictApproved,
    verdictPill: verdictApproved
      ? VERDICT_PILL.approved
      : report.verificationVerdict === "rejected"
        ? VERDICT_PILL.rejected
        : VERDICT_PILL.unreviewed,
    approvesOnSend,
    canApproveHere: !verdictApproved && !approvesOnSend,
    routeLabel: routeButtonLabel(routeAction, verdictApproved),
    routeBlocked:
      routeAction.kind === "already_sent"
        ? "This report was already sent. Resend it from the Mail thread."
        : null,
    followupBlocked: !report.city.contact
      ? "No city contact on file"
      : report.outreach.threadId === null
        ? "Send the report to the city first. A follow-up goes on that conversation."
        : null,
    rejectBlocked:
      report.verificationVerdict === "rejected" && !approvedLocally
        ? "This report is already rejected."
        : null,
  }
}

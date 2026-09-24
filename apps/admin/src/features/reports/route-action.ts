import type { AdminReportDTO, ReportOutreachStatus } from "@civfix/shared"

type RouteActionKind =
  | "send"
  | "resend"
  | "already_sent"
  | "no_contact"
  | "no_jurisdiction"

export interface RouteAction {
  kind: RouteActionKind
  routedAt: string | null
}

export type RoutableReport = Pick<AdminReportDTO, "geoid" | "city" | "outreach">

const SENT_OUTREACH_STATUSES: readonly ReportOutreachStatus[] = ["sent", "delivered", "replied"]

export function routeActionView(report: RoutableReport): RouteAction {
  const routedAt = report.outreach.routedAt
  if (!report.city.contact) {
    return { kind: report.geoid === null ? "no_jurisdiction" : "no_contact", routedAt }
  }
  if (report.outreach.sendFailed === true) return { kind: "resend", routedAt }
  if (SENT_OUTREACH_STATUSES.includes(report.outreach.status)) {
    return { kind: "already_sent", routedAt }
  }
  if (report.outreach.status === "bounced") return { kind: "resend", routedAt }
  return { kind: "send", routedAt }
}

/**
 * The one-step send label. An unreviewed report gets its verification verdict set to approved as the first
 * half of the same click, so the button says so; once the verdict is approved (including a routing retry
 * after the verdict already landed) it is a plain send and must not re-approve.
 */
export function routeSendLabel(verdictApproved: boolean): string {
  return verdictApproved ? "Send to city" : "Verify and send to city"
}

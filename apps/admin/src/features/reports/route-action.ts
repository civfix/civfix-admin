import type { AdminReportDTO } from "@civfix/shared"

export type RouteActionKind =
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

const SENT_OUTREACH_STATUSES: readonly string[] = ["sent", "delivered", "replied"]

export function routeActionFor(report: RoutableReport): RouteAction {
  const routedAt = report.outreach.routedAt
  if (!report.city.contact) {
    return { kind: report.geoid === null ? "no_jurisdiction" : "no_contact", routedAt }
  }
  if (SENT_OUTREACH_STATUSES.includes(report.outreach.status)) {
    return { kind: "already_sent", routedAt }
  }
  if (report.outreach.status === "bounced") return { kind: "resend", routedAt }
  return { kind: "send", routedAt }
}

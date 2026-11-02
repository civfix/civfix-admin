import type {
  AdminReportFilingRoute,
  FilingChannel,
  FilingReason,
  FilingStatus,
} from "@civfix/contract"

// D14's words: the report card, the Filings rows and the tests all use exactly these.
export const FILING_REASON_LABEL: Record<FilingReason, string> = {
  no_route: "No filing route",
  route_disabled: "Route disabled",
  manual_route: "Manual route",
  filing_off: "Automatic filing is off",
  dry_run: "Dry run",
  captcha: "The city site showed a CAPTCHA",
  login_required: "The city site needs a sign-in",
  missing_info: "The city form needs information the report lacks",
  portal_error: "The city site or mail failed",
  attempts_exhausted: "Attempts used up",
  uncertain_submission: "Unsure whether it was submitted — check the city site",
  ai_unavailable: "Claude is unavailable",
  city_needs_info: "The city asked for more information",
  reopened_after_city_closed: "Reopened after the city closed it",
  other: "Other",
}

export const FILING_STATUS_LABEL: Record<FilingStatus, string> = {
  queued: "Queued",
  running: "Filing…",
  submitted: "Filed",
  linked_existing: "Linked",
  needs_human: "Needs a human",
  cancelled: "Cancelled",
}

export const FILING_STATUS_PILL: Record<FilingStatus, string> = {
  queued: "status-new",
  running: "status-progress",
  submitted: "status-ok",
  linked_existing: "status-ok",
  needs_human: "status-flag",
  cancelled: "priority-low",
}

export const FILING_CHANNEL_LABEL: Record<FilingChannel, string> = {
  email: "Email",
  portal: "Portal",
  manual: "Manual",
}

/** Null when the server sent no route at all (an older backend), which shows no line. */
export function filingRouteLine(route: AdminReportFilingRoute | null | undefined): string | null {
  if (route === undefined) return null
  if (route === null) return "No route — needs a human"
  if (route.channel === "manual") return "Manual route"
  const channel = FILING_CHANNEL_LABEL[route.channel]
  return route.target === null ? channel : `${channel} · ${route.target}`
}

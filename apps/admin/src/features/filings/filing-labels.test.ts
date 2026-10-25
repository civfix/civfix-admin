import {
  FilingChannelSchema,
  FilingReasonSchema,
  FilingStatusSchema,
  type AdminReportFilingRoute,
} from "@civfix/contract"
import { describe, expect, it } from "vitest"

import {
  FILING_CHANNEL_LABEL,
  FILING_REASON_LABEL,
  FILING_STATUS_LABEL,
  filingRouteLine,
} from "./filing-labels"

describe("filing labels", () => {
  it("T1: words every reason exactly as D14 does, with no key outside the enum", () => {
    expect(FILING_REASON_LABEL).toEqual({
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
    })
    expect(Object.keys(FILING_REASON_LABEL).sort()).toEqual([...FilingReasonSchema.options].sort())
  })

  it("T2: words every status chip", () => {
    expect(FILING_STATUS_LABEL).toEqual({
      queued: "Queued",
      running: "Filing…",
      submitted: "Filed",
      linked_existing: "Linked",
      needs_human: "Needs a human",
      cancelled: "Cancelled",
    })
    expect(Object.keys(FILING_STATUS_LABEL).sort()).toEqual([...FilingStatusSchema.options].sort())
  })

  it("T3: words every channel", () => {
    expect(FILING_CHANNEL_LABEL).toEqual({ email: "Email", portal: "Portal", manual: "Manual" })
    expect(Object.keys(FILING_CHANNEL_LABEL).sort()).toEqual([...FilingChannelSchema.options].sort())
  })

  it.each<[string, AdminReportFilingRoute | null | undefined, string | null]>([
    ["a portal", { channel: "portal", target: "myla311.lacity.gov" }, "Portal · myla311.lacity.gov"],
    ["an email", { channel: "email", target: "311@lacity.org" }, "Email · 311@lacity.org"],
    ["a manual", { channel: "manual", target: null }, "Manual route"],
    ["no", null, "No route — needs a human"],
    ["an absent", undefined, null],
  ])("T4: lines %s route", (_name, route, line) => {
    expect(filingRouteLine(route)).toBe(line)
  })
})

import { describe, expect, it } from "vitest"

import { sendPanelView, type SendPanelReport } from "./send-panel"

type Verdict = SendPanelReport["verificationVerdict"]

const CITY = { dept: "Public Works", place: "Oakland", contact: "works@oaklandca.gov", routed: false }
const ROUTED_AT = "2026-09-22T10:00:00.000Z"

function report(over: Partial<SendPanelReport> = {}): SendPanelReport {
  return {
    city: CITY,
    outreach: { status: "not_sent", threadId: null, routedTo: null, routedAt: null },
    verificationVerdict: null,
    ...over,
  }
}

const SENT = { status: "sent", threadId: "t-1", routedTo: CITY.contact, routedAt: ROUTED_AT } as const
const NO_CONTACT = { ...CITY, contact: null }

describe("sendPanelView", () => {
  it.each<[string, Verdict, boolean, { approved: boolean; pill: string }]>([
    ["unreviewed", null, false, { approved: false, pill: "Not yet reviewed" }],
    ["approved on the server", "approved", false, { approved: true, pill: "Approved" }],
    ["approved locally", null, true, { approved: true, pill: "Approved" }],
    ["rejected", "rejected", false, { approved: false, pill: "Rejected" }],
    ["rejected on the server, approved locally since", "rejected", true, { approved: true, pill: "Approved" }],
  ])("a report that is %s", (_name, verdict, approvedLocally, want) => {
    const view = sendPanelView(report({ verificationVerdict: verdict }), approvedLocally)
    expect(view.verdictApproved).toBe(want.approved)
    expect(view.verdictPill.label).toBe(want.pill)
  })

  it("blocks a follow-up until the first send opened a thread", () => {
    expect(sendPanelView(report({ outreach: SENT }), false).followupBlocked).toBeNull()
  })

  it("blocks Reject only while the server verdict is rejected and no local approve overrides it", () => {
    expect(sendPanelView(report({ verificationVerdict: "rejected" }), false).rejectBlocked).toBe(
      "This report is already rejected.",
    )
    expect(sendPanelView(report({ verificationVerdict: "rejected" }), true).rejectBlocked).toBeNull()
    expect(sendPanelView(report({ verificationVerdict: "approved" }), false).rejectBlocked).toBeNull()
    expect(sendPanelView(report(), false).rejectBlocked).toBeNull()
  })
})

describe("sendPanelView follow-up gate", () => {
  it("T29: keeps today's followupBlocked text", () => {
    expect(sendPanelView(report({ city: NO_CONTACT }), false).followupBlocked).toBe("No city contact on file")
    expect(sendPanelView(report({ outreach: { ...SENT, threadId: null } }), false).followupBlocked).toBe(
      "Send the report to the city first. A follow-up goes on that conversation.",
    )
  })
})

import { describe, expect, it } from "vitest"

import { sendPanelView, type SendPanelReport } from "./send-panel"

type Verdict = SendPanelReport["verificationVerdict"]

const CITY = { dept: "Public Works", place: "Oakland", contact: "works@oaklandca.gov", routed: false }
const ROUTED_AT = "2026-09-22T10:00:00.000Z"

function report(over: Partial<SendPanelReport> = {}): SendPanelReport {
  return {
    geoid: "0653000",
    city: CITY,
    outreach: { status: "not_sent", threadId: null, routedTo: null, routedAt: null },
    verificationVerdict: null,
    ...over,
  }
}

const SENT = { status: "sent", threadId: "t-1", routedTo: CITY.contact, routedAt: ROUTED_AT } as const
const BOUNCED = { status: "bounced", threadId: "t-1", routedTo: CITY.contact, routedAt: ROUTED_AT } as const
const NO_CONTACT = { ...CITY, contact: null }

describe("sendPanelView", () => {
  it.each<[string, Verdict, boolean, { approvesOnSend: boolean; canApproveHere: boolean; label: string; pill: string }]>([
    ["unreviewed", null, false, { approvesOnSend: true, canApproveHere: false, label: "Verify and send to city", pill: "Not yet reviewed" }],
    ["approved on the server", "approved", false, { approvesOnSend: false, canApproveHere: false, label: "Send to city", pill: "Approved" }],
    ["approved locally", null, true, { approvesOnSend: false, canApproveHere: false, label: "Send to city", pill: "Approved" }],
    // Pinned as found: sending re-approves a rejected report. Whether it should is a product question.
    ["rejected", "rejected", false, { approvesOnSend: true, canApproveHere: false, label: "Verify and send to city", pill: "Rejected" }],
    ["rejected on the server, approved locally since", "rejected", true, { approvesOnSend: false, canApproveHere: false, label: "Send to city", pill: "Approved" }],
  ])("a sendable report that is %s", (_name, verdict, approvedLocally, want) => {
    const view = sendPanelView(report({ verificationVerdict: verdict }), approvedLocally)
    expect(view.routeAction.kind).toBe("send")
    expect(view.approvesOnSend).toBe(want.approvesOnSend)
    expect(view.canApproveHere).toBe(want.canApproveHere)
    expect(view.routeLabel).toBe(want.label)
    expect(view.verdictPill.label).toBe(want.pill)
    expect(view.routeBlocked).toBeNull()
  })

  it("offers Approve on its own once the report went out unreviewed", () => {
    const view = sendPanelView(report({ outreach: SENT }), false)
    expect(view.routeAction.kind).toBe("already_sent")
    expect(view.approvesOnSend).toBe(false)
    expect(view.canApproveHere).toBe(true)
    expect(view.routeLabel).toBe("Already sent · 9/22/2026, 10:00:00 AM")
    expect(view.routeBlocked).toBe("This report was already sent. Resend it from the Mail thread.")
  })

  it("labels an already-sent report without a send time", () => {
    const view = sendPanelView(report({ outreach: { ...SENT, routedAt: null } }), false)
    expect(view.routeLabel).toBe("Already sent")
  })

  it("offers a resend after a bounce without re-approving", () => {
    const view = sendPanelView(report({ outreach: BOUNCED, verificationVerdict: "approved" }), false)
    expect(view.routeAction.kind).toBe("resend")
    expect(view.routeLabel).toBe("Send again to jurisdiction")
    expect(view.approvesOnSend).toBe(false)
    expect(view.canApproveHere).toBe(false)
  })

  it.each([
    ["no_contact", report({ city: NO_CONTACT })],
    ["no_jurisdiction", report({ city: NO_CONTACT, geoid: null })],
  ] as const)("lets an unroutable report (%s) be approved here", (kind, r) => {
    const view = sendPanelView(r, false)
    expect(view.routeAction.kind).toBe(kind)
    expect(view.approvesOnSend).toBe(false)
    expect(view.canApproveHere).toBe(true)
    expect(view.followupBlocked).toBe("No city contact on file")
  })

  it("blocks a follow-up until the first send opened a thread", () => {
    expect(sendPanelView(report(), false).followupBlocked).toBe(
      "Send the report to the city first. A follow-up goes on that conversation.",
    )
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

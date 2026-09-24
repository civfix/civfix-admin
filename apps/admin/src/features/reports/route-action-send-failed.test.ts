import { describe, expect, it } from "vitest"

import { routeActionFor, type RoutableReport } from "./route-action"

function routedReport(outreach: Partial<RoutableReport["outreach"]>): RoutableReport {
  return {
    geoid: "0644000",
    city: { dept: "Public Works", place: "Los Angeles", contact: "pw@lacity.org", routed: true },
    outreach: {
      status: "sent",
      threadId: "THREAD-1",
      routedTo: "pw@lacity.org",
      routedAt: "2026-09-01T10:00:00.000Z",
      ...outreach,
    },
  }
}

describe("routeActionFor with a failed send", () => {
  it("offers a resend even when the outreach status reads delivered or replied", () => {
    for (const status of ["delivered", "replied"] as const) {
      expect(routeActionFor(routedReport({ status, sendFailed: true })).kind).toBe("resend")
    }
  })

  it("treats an explicit sendFailed false like an absent flag", () => {
    expect(routeActionFor(routedReport({ status: "sent", sendFailed: false })).kind).toBe(
      "already_sent",
    )
    expect(routeActionFor(routedReport({ status: "not_sent", sendFailed: false })).kind).toBe("send")
  })
})

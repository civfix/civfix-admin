import { describe, expect, it } from "vitest"

import { queryKeys } from "@/lib/query"
import { routeActionView, routeSendLabel, type RoutableReport } from "./route-action"

function makeReport(over: Partial<RoutableReport> = {}): RoutableReport {
  return {
    geoid: "0644000",
    city: { dept: "Public Works", place: "Los Angeles", contact: "pw@lacity.org", routed: true },
    outreach: { status: "not_sent", threadId: null, routedTo: null, routedAt: null },
    ...over,
  }
}

describe("routeActionView", () => {
  it("offers the send when a contact is on file and nothing has gone out", () => {
    expect(routeActionView(makeReport()).kind).toBe("send")
  })

  it("blocks the send when the jurisdiction has no contact", () => {
    expect(routeActionView(makeReport({ city: { ...makeReport().city, contact: null } })).kind).toBe(
      "no_contact",
    )
    expect(routeActionView(makeReport({ city: { ...makeReport().city, contact: "" } })).kind).toBe(
      "no_contact",
    )
  })

  it("reports a missing jurisdiction separately from a missing contact", () => {
    const report = makeReport({ geoid: null, city: { ...makeReport().city, contact: null } })
    expect(routeActionView(report).kind).toBe("no_jurisdiction")
  })

  it("marks already-sent outreach and carries the routed timestamp", () => {
    for (const status of ["sent", "delivered", "replied"] as const) {
      const action = routeActionView(
        makeReport({
          outreach: {
            status,
            threadId: "THREAD-1",
            routedTo: "pw@lacity.org",
            routedAt: "2026-09-01T10:00:00.000Z",
          },
        }),
      )
      expect(action.kind).toBe("already_sent")
      expect(action.routedAt).toBe("2026-09-01T10:00:00.000Z")
    }
  })

  it("re-enables the send after a bounce", () => {
    const action = routeActionView(
      makeReport({
        outreach: {
          status: "bounced",
          threadId: "THREAD-1",
          routedTo: "pw@lacity.org",
          routedAt: "2026-09-01T10:00:00.000Z",
        },
      }),
    )
    expect(action.kind).toBe("resend")
  })

  it("re-enables the send when the last attempt was rejected by the provider", () => {
    const action = routeActionView(
      makeReport({
        outreach: {
          status: "sent",
          threadId: "THREAD-1",
          routedTo: "pw@lacity.org",
          routedAt: "2026-09-01T10:00:00.000Z",
          sendFailed: true,
        },
      }),
    )
    expect(action.kind).toBe("resend")
    expect(action.routedAt).toBe("2026-09-01T10:00:00.000Z")
  })
})

describe("routeSendLabel", () => {
  it("folds verification into the send for an unreviewed report", () => {
    expect(routeSendLabel(false)).toBe("Verify and send to city")
  })

  it("drops the verify half once the verdict is approved, so a retry never re-approves", () => {
    expect(routeSendLabel(true)).toBe("Send to city")
  })
})

describe("report query keys", () => {
  it("keeps the flat page cache apart from the infinite list cache", () => {
    expect(JSON.stringify(queryKeys.reports.page({}))).not.toBe(
      JSON.stringify(queryKeys.reports.list({})),
    )
    expect(JSON.stringify(queryKeys.reports.page(undefined))).not.toBe(
      JSON.stringify(queryKeys.reports.list(undefined)),
    )
  })
})

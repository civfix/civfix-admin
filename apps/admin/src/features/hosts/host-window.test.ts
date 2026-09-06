import { describe, expect, it } from "vitest"
import type { AdminBroadcastListItemDTO } from "@civfix/shared"

import {
  HOST_ACTIVITY_WINDOW_DAYS,
  eventsFromBroadcasts,
  hostActivityWindow,
  hostBroadcastParams,
  hostListParams,
} from "./host-window"

const NOW = Date.parse("2026-09-06T12:00:00.000Z")

function broadcast(over: Partial<AdminBroadcastListItemDTO>): AdminBroadcastListItemDTO {
  return {
    id: "b1",
    cleanupId: "c1",
    kind: "host_broadcast",
    status: "sent",
    channels: ["email"],
    recipientCount: 0,
    sentCount: 0,
    failedCount: 0,
    suppressedCount: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...over,
  }
}

describe("host activity window", () => {
  it("opens at the counter window's floor and stays open-ended forward", () => {
    expect(hostActivityWindow(NOW)).toEqual({ from: "2026-08-07T12:00:00.000Z" })
    expect(HOST_ACTIVITY_WINDOW_DAYS).toBe(30)
  })

  it("asks the server for one host's own broadcasts since that floor", () => {
    expect(hostBroadcastParams("u1", hostActivityWindow(NOW))).toEqual({
      createdBy: "u1",
      kind: "host_broadcast",
      from: "2026-08-07T12:00:00.000Z",
    })
  })

  it("never pins an upper bound, so a broadcast sent while the page is open still shows", () => {
    expect(hostBroadcastParams("u1", hostActivityWindow(NOW))).not.toHaveProperty("to")
  })
})

describe("host list params", () => {
  it("sends no suspension facet for the all chip", () => {
    expect(hostListParams("all", "  rivera ")).toEqual({ q: "rivera", windowDays: 30 })
  })

  it("maps the active and suspended chips to the boolean facet", () => {
    expect(hostListParams("suspended", "")).toEqual({
      suspended: true,
      q: undefined,
      windowDays: 30,
    })
    expect(hostListParams("active", "")).toEqual({
      suspended: false,
      q: undefined,
      windowDays: 30,
    })
  })

  it("drops an unknown chip instead of sending it", () => {
    expect(hostListParams("bogus", "x")).toEqual({ q: "x", windowDays: 30 })
  })
})

describe("events reached", () => {
  it("lists each event once and prefers its title over an id", () => {
    expect(
      eventsFromBroadcasts([
        broadcast({ id: "b1", cleanupId: "c1" }),
        broadcast({ id: "b2", cleanupId: "c1", eventTitle: "Echo Park cleanup" }),
        broadcast({ id: "b3", cleanupId: "c2", eventTitle: "Ballona wetlands" }),
      ]),
    ).toEqual([
      { cleanupId: "c1", title: "Echo Park cleanup" },
      { cleanupId: "c2", title: "Ballona wetlands" },
    ])
  })

  it("falls back to a neutral label when no broadcast carried a title", () => {
    expect(eventsFromBroadcasts([broadcast({ cleanupId: "c9" })])).toEqual([
      { cleanupId: "c9", title: "Untitled event" },
    ])
  })
})

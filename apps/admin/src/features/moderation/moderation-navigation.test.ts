import { describe, expect, it } from "vitest"

import { moderationDestination } from "./moderation-navigation"

describe("moderationDestination", () => {
  it("uses explicit report/event destinations and never guesses from a chat/photo subject", () => {
    expect(moderationDestination("report", "REPORT-1")).toEqual({
      page: "reports",
      id: "REPORT-1",
    })
    expect(moderationDestination("event", "EVENT-1")).toEqual({
      page: "events",
      id: "EVENT-1",
    })
    expect(moderationDestination(null, null)).toBeNull()
    expect(moderationDestination("report", null)).toBeNull()
  })
})

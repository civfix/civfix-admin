import { describe, expect, it } from "vitest"

import { getModerationDestination } from "./moderation-navigation"

describe("getModerationDestination", () => {
  it("uses explicit report/event destinations and never guesses from a chat/photo subject", () => {
    expect(getModerationDestination("report", "REPORT-1")).toEqual({
      page: "reports",
      id: "REPORT-1",
    })
    expect(getModerationDestination("event", "EVENT-1")).toEqual({
      page: "events",
      id: "EVENT-1",
    })
    expect(getModerationDestination(null, null)).toBeNull()
    expect(getModerationDestination("report", null)).toBeNull()
  })
})

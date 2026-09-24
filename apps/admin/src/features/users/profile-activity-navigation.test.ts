import { describe, expect, it } from "vitest"

import { userMessageDestination } from "./profile-activity-navigation"

describe("profile activity row navigation", () => {
  it("navigates only sources with a matching admin detail page", () => {
    expect(userMessageDestination({ source: "chat", sourceId: "event-1" })).toEqual({
      page: "events",
      id: "event-1",
    })
    expect(userMessageDestination({ source: "report", sourceId: "report-1" })).toEqual({
      page: "reports",
      id: "report-1",
    })
    expect(userMessageDestination({ source: "group", sourceId: "group-1" })).toBeNull()
    expect(userMessageDestination({ source: "dm", sourceId: null })).toBeNull()
  })
})

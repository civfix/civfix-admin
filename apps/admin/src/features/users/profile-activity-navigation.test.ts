import { describe, expect, it } from "vitest"

import { getUserMessageDestination } from "./profile-activity-navigation"

describe("profile activity row navigation", () => {
  it("navigates only sources with a matching admin detail page", () => {
    expect(getUserMessageDestination({ source: "chat", sourceId: "event-1" })).toEqual({
      page: "events",
      id: "event-1",
    })
    expect(getUserMessageDestination({ source: "report", sourceId: "report-1" })).toEqual({
      page: "reports",
      id: "report-1",
    })
    expect(getUserMessageDestination({ source: "group", sourceId: "group-1" })).toBeNull()
    expect(getUserMessageDestination({ source: "dm", sourceId: null })).toBeNull()
  })
})

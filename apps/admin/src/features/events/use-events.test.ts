import { describe, expect, it } from "vitest"

import * as useEvents from "./use-events"

describe("admin event mutations", () => {
  it("offers no hook that writes an event status by hand", () => {
    expect(Object.keys(useEvents)).not.toContain("useSetEventStatus")
  })

  it("keeps the operator actions that are still real decisions", () => {
    const exported = Object.keys(useEvents)
    expect(exported).toEqual(
      expect.arrayContaining([
        "useFlagEvent",
        "useCancelEvent",
        "usePostEventMessage",
        "useSetEventOutcome",
        "useLinkReports",
        "useUnlinkReport",
      ]),
    )
  })
})

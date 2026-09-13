import { describe, expect, it } from "vitest"
import type { EventStatus } from "@civfix/shared"

import { EVENT_STATUS_VIEW, eventStatusView } from "./event-status"

describe("event status pills", () => {
  it("reads the derived statuses as clock readings, not as operator decisions", () => {
    expect(eventStatusView("upcoming").label).toBe("Upcoming")
    expect(eventStatusView("in_progress").label).toBe("Happening now")
    expect(eventStatusView("completed").label).toBe("Ended")
  })

  it("keeps cancelled as the one status an operator can produce", () => {
    expect(eventStatusView("cancelled").label).toBe("Cancelled")
    expect(eventStatusView("cancelled").cls).toBe("status-flag")
  })

  it("covers every wire status so a pill never renders blank", () => {
    const statuses: EventStatus[] = ["upcoming", "in_progress", "completed", "cancelled"]
    for (const status of statuses) {
      expect(EVENT_STATUS_VIEW[status].cls).toBeTruthy()
      expect(EVENT_STATUS_VIEW[status].label).toBeTruthy()
    }
  })

  it("falls back to Upcoming for a status this build does not know", () => {
    expect(eventStatusView("archived" as EventStatus)).toEqual(EVENT_STATUS_VIEW.upcoming)
  })
})

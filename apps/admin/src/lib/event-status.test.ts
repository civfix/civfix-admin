import { describe, expect, it } from "vitest"
import { EVENT_STATUS_LABELS, type EventStatus } from "@civfix/shared"

import { cancelBlockedFor, EVENT_STATUS_VIEW, eventStatusView } from "./event-status"

describe("event status pills", () => {
  it("renders every label from the shared contract map rather than a local fork", () => {
    const statuses: EventStatus[] = ["upcoming", "in_progress", "completed", "cancelled"]
    for (const status of statuses) {
      expect(eventStatusView(status).label).toBe(EVENT_STATUS_LABELS[status])
    }
  })

  it("keeps cancelled as the one status an operator can produce", () => {
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

describe("cancel availability", () => {
  it("blocks cancelling an event the clock has already ended, matching the API's 409", () => {
    expect(cancelBlockedFor("completed")).toBe(
      "This event has already ended and can't be cancelled.",
    )
  })

  it("blocks cancelling an event that is already cancelled", () => {
    expect(cancelBlockedFor("cancelled")).toBe("This event is already cancelled.")
  })

  it("allows cancelling while the event is still upcoming or running", () => {
    expect(cancelBlockedFor("upcoming")).toBeNull()
    expect(cancelBlockedFor("in_progress")).toBeNull()
  })
})

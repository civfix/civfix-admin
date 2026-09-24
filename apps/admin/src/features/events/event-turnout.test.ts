import { describe, expect, it } from "vitest"

import { turnoutLabel, turnoutPercent } from "./event-turnout"

describe("turnoutPercent", () => {
  it("reads zero when there is no capacity to fill", () => {
    expect(turnoutPercent(12, null)).toBe(0)
    expect(turnoutPercent(12, undefined)).toBe(0)
    expect(turnoutPercent(12, 0)).toBe(0)
  })

  it("rounds to a whole percent of capacity", () => {
    expect(turnoutPercent(1, 3)).toBe(33)
    expect(turnoutPercent(2, 3)).toBe(67)
  })

  it("caps an overbooked event at a full bar", () => {
    expect(turnoutPercent(30, 20)).toBe(100)
  })
})

describe("turnoutLabel", () => {
  it("words the count by where the event stands", () => {
    expect(turnoutLabel("cancelled")).toBe("had RSVP’d")
    expect(turnoutLabel("completed")).toBe("attended")
    expect(turnoutLabel("upcoming")).toBe("RSVP’d")
    expect(turnoutLabel("in_progress")).toBe("RSVP’d")
  })
})

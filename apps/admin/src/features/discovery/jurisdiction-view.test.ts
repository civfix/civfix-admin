import { describe, expect, it } from "vitest"

import { EMPTY_VALUE } from "@/lib/empty-value"

import {
  LAYER_LABEL,
  dominantCategory,
  formatWaitingAge,
  isOverdue,
} from "./jurisdiction-view"

const NOW = Date.parse("2026-09-24T12:00:00.000Z")
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString()
}

describe("jurisdiction row formatting", () => {
  it.each([
    [30_000, "just now"],
    [5 * MINUTE, "5m"],
    [3 * 60 * MINUTE, "3h"],
    [3 * DAY, "3d"],
    [20 * DAY, "2w"],
    [90 * DAY, "3mo"],
    [800 * DAY, "2y"],
  ])("ages a report waiting %i ms as %s", (elapsed, label) => {
    expect(formatWaitingAge(ago(elapsed), NOW)).toBe(label)
  })

  it("shows the empty value for a missing or unreadable age", () => {
    expect(formatWaitingAge(null, NOW)).toBe(EMPTY_VALUE)
    expect(formatWaitingAge("not a date", NOW)).toBe(EMPTY_VALUE)
  })

  it("marks a report overdue after a day", () => {
    expect(isOverdue(ago(DAY - MINUTE), NOW)).toBe(false)
    expect(isOverdue(ago(DAY + MINUTE), NOW)).toBe(true)
    expect(isOverdue(null, NOW)).toBe(false)
  })

  it("picks the category with the most waiting reports", () => {
    expect(dominantCategory({ trash: 1, graffiti: 3 })).toBe("graffiti")
    expect(dominantCategory({})).toBeNull()
  })

  it("labels every layer", () => {
    expect(LAYER_LABEL).toEqual({
      state: "State",
      county: "County",
      place: "City",
      federal: "Federal land",
      tribal: "Tribal",
    })
  })
})

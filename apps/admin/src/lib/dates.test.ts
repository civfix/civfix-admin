import { describe, expect, it } from "vitest"

import {
  formatAgo,
  formatDate,
  formatDateTime,
  formatPreciseDateTime,
  preciseDateTimeTitle,
} from "./dates"
import { EMPTY_VALUE } from "./empty-value"

describe("formatDate", () => {
  it.each([null, undefined, ""])("renders the placeholder for %j", (value) => {
    expect(formatDate(value)).toBe(EMPTY_VALUE)
  })

  it.each([
    ["2026-09-23T14:05:00.000Z", "Sep 23, 2026"],
    ["2026-01-01", "Jan 1, 2026"],
    ["2024-02-29T23:59:59+05:30", "Feb 29, 2024"],
  ])("formats %s as a short local date", (iso, expected) => {
    expect(formatDate(iso)).toBe(expected)
  })

  it.each(["not a date", "2026-13-45", " "])(
    "returns an unparseable string %j unchanged",
    (value) => {
      expect(formatDate(value)).toBe(value)
    },
  )
})

describe("formatDateTime", () => {
  it.each([null, undefined, ""])("renders the placeholder for %j", (value) => {
    expect(formatDateTime(value)).toBe(EMPTY_VALUE)
  })

  it.each([
    ["2026-09-23T14:05:00.000Z", "Sep 23, 2026, 2:05 PM"],
    ["2026-01-01T00:00:00Z", "Jan 1, 2026, 12:00 AM"],
    ["2024-02-29T23:59:59+05:30", "Feb 29, 2024, 6:29 PM"],
  ])("formats %s as a short local date and time", (iso, expected) => {
    expect(formatDateTime(iso)).toBe(expected)
  })

  it.each(["not a date", "2026-13-45", " "])(
    "returns an unparseable string %j unchanged",
    (value) => {
      expect(formatDateTime(value)).toBe(value)
    },
  )
})

describe("formatPreciseDateTime", () => {
  it.each([null, undefined, ""])("renders the placeholder for %j", (value) => {
    expect(formatPreciseDateTime(value)).toBe(EMPTY_VALUE)
  })

  it("keeps the seconds", () => {
    expect(formatPreciseDateTime("2026-09-23T14:05:07.000Z")).toBe("Sep 23, 2026, 2:05:07 PM")
  })

  it("returns an unparseable string unchanged", () => {
    expect(formatPreciseDateTime("not a date")).toBe("not a date")
  })
})

describe("preciseDateTimeTitle", () => {
  it("titles a parseable time with seconds", () => {
    expect(preciseDateTimeTitle("2026-09-23T14:05:07.000Z")).toBe("Sep 23, 2026, 2:05:07 PM")
  })

  it.each(["", "not a date"])("gives no title for %j", (value) => {
    expect(preciseDateTimeTitle(value)).toBeUndefined()
  })
})

describe("formatAgo", () => {
  const NOW = Date.parse("2026-10-24T12:00:00.000Z")
  const SECOND = 1000
  const MINUTE = 60 * SECOND
  const HOUR = 60 * MINUTE
  const DAY = 24 * HOUR
  const before = (ms: number) => new Date(NOW - ms).toISOString()

  it.each([
    ["T1", 30 * SECOND, "just now"],
    ["T2", 59 * SECOND, "just now"],
    ["T3", 60 * SECOND, "1 min ago"],
    ["T4", 5 * MINUTE, "5 min ago"],
    ["T5", 59 * MINUTE + 59 * SECOND, "59 min ago"],
    ["T6", 60 * MINUTE, "1 h ago"],
    ["T7", 2 * HOUR + 30 * MINUTE, "2 h ago"],
    ["T8", 23 * HOUR + 59 * MINUTE, "23 h ago"],
    ["T9", 24 * HOUR, "1 d ago"],
    ["T10", 3 * DAY + 5 * HOUR, "3 d ago"],
    ["T11", -10 * MINUTE, "just now"],
  ])("%s: %d ms before now reads %j", (_id, ago, expected) => {
    expect(formatAgo(before(ago), NOW)).toBe(expected)
  })

  it("T12: an unparseable value is shown as sent", () => {
    expect(formatAgo("not-a-date", NOW)).toBe("not-a-date")
  })
})

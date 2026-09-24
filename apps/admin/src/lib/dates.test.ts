import { describe, expect, it } from "vitest"

import { formatDate, formatDateTime, formatMonthDay, formatPreciseDateTime } from "./dates"
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

  it.each(["not a date", "2026-13-45", " "])("returns an unparseable string %j unchanged", (value) => {
    expect(formatDate(value)).toBe(value)
  })
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

  it.each(["not a date", "2026-13-45", " "])("returns an unparseable string %j unchanged", (value) => {
    expect(formatDateTime(value)).toBe(value)
  })
})

describe("formatMonthDay", () => {
  it.each([null, undefined, ""])("renders the placeholder for %j", (value) => {
    expect(formatMonthDay(value)).toBe(EMPTY_VALUE)
  })

  it("formats a short local month and day", () => {
    expect(formatMonthDay("2026-09-23T14:05:00.000Z")).toBe("Sep 23")
  })

  it("returns an unparseable string unchanged", () => {
    expect(formatMonthDay("not a date")).toBe("not a date")
  })
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

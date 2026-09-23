import { describe, expect, it } from "vitest"

import { formatDate, formatDateTime } from "./dates"

const PLACEHOLDER = "\u2014"

// Expected strings are built with the same Intl arguments the code uses so the runner's locale and
// time zone cannot flake the assertions.
function expectedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function expectedDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

describe("formatDate", () => {
  it.each([null, undefined, ""])("renders the placeholder for %j", (value) => {
    expect(formatDate(value)).toBe(PLACEHOLDER)
  })

  it.each(["2026-09-23T14:05:00.000Z", "2026-01-01", "2024-02-29T23:59:59+05:30"])(
    "formats %s as a short local date",
    (iso) => {
      expect(formatDate(iso)).toBe(expectedDate(iso))
    },
  )

  it.each(["not a date", "2026-13-45", " "])("returns an unparseable string %j unchanged", (value) => {
    expect(formatDate(value)).toBe(value)
  })
})

describe("formatDateTime", () => {
  it.each([null, undefined, ""])("renders the placeholder for %j", (value) => {
    expect(formatDateTime(value)).toBe(PLACEHOLDER)
  })

  it.each(["2026-09-23T14:05:00.000Z", "2026-01-01T00:00:00Z", "2024-02-29T23:59:59+05:30"])(
    "formats %s as a short local date and time",
    (iso) => {
      expect(formatDateTime(iso)).toBe(expectedDateTime(iso))
    },
  )

  it("is longer than the date-only form for the same instant", () => {
    const iso = "2026-09-23T14:05:00.000Z"
    expect(formatDateTime(iso).length).toBeGreaterThan(formatDate(iso).length)
  })

  it.each(["not a date", "2026-13-45", " "])("returns an unparseable string %j unchanged", (value) => {
    expect(formatDateTime(value)).toBe(value)
  })
})

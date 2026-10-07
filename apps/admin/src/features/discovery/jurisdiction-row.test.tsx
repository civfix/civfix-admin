import { render } from "@testing-library/react"
import type { JurisdictionDirectoryDTO } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import { MINUTE_MS } from "@/lib/timing"
import { JurisdictionRow } from "@/features/discovery/jurisdiction-row"

const HOUR_MS = 60 * MINUTE_MS
const NOW = Date.parse("2026-09-20T15:00:00.000Z")

const ITEM = {
  geoid: "0644000",
  org: "Los Angeles",
  dept: null,
  email: null,
  form: null,
  method: "none",
  status: "pending",
  coverage: "City limits",
  lastRouted: null,
  layer: "place",
  population: 3_898_747,
  reportsWaiting: 4,
  perCategoryCounts: { trash: 3, graffiti: 1 },
  contacts: [],
  flaggedAt: null,
  handle: null,
  oldestReportAt: new Date(NOW - 23 * HOUR_MS).toISOString(),
  forwardSubjectTemplate: null,
  forwardBodyTemplate: null,
} satisfies JurisdictionDirectoryDTO

describe("JurisdictionRow waiting age", () => {
  it("reads its age and overdue state from the now prop", () => {
    const row = (now: number) => (
      <JurisdictionRow item={ITEM} selected={false} onSelect={() => undefined} now={now} showOldest />
    )
    const { container, rerender } = render(row(NOW))
    const age = () => container.querySelector(".juris-age")
    expect(age()).toHaveTextContent("23h")
    expect(age()).not.toHaveClass("overdue")

    rerender(row(NOW + 2 * HOUR_MS))
    expect(age()).toHaveTextContent("1d")
    expect(age()).toHaveClass("overdue")
  })
})

import type { AdminUserHoursEntryDTO } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import { formatDate } from "@/lib/dates"

import {
  affectedCertificateLine,
  formatHours,
  formatServiceDate,
  hoursEntryCreditor,
  hoursEntryDate,
  hoursEntryMeta,
  hoursEntryTitle,
  hoursEntryVoidDetail,
  voidedToast,
} from "./user-hours"

const USER_ID = "00000000-0000-4000-8000-000000000001"
const OFFICIAL_ID = "00000000-0000-4000-8000-0000000000c1"

function entry(over: Partial<AdminUserHoursEntryDTO> = {}): AdminUserHoursEntryDTO {
  return {
    id: "00000000-0000-4000-8000-0000000000e1",
    source: "event",
    hours: 2.5,
    occurredAt: "2026-09-12T17:00:00.000Z",
    creditedAt: "2026-09-13T09:00:00.000Z",
    serviceDate: null,
    event: {
      id: "00000000-0000-4000-8000-0000000000a1",
      title: "Echo Park Lake cleanup",
      referenceCode: null,
    },
    jurisdiction: { geoid: "0644000", name: "Los Angeles" },
    creditedBy: { id: USER_ID, name: "Maya Host", handle: "@maya", official: false },
    operator: null,
    note: null,
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
    voidable: true,
    ...over,
  }
}

const manual = (over: Partial<AdminUserHoursEntryDTO> = {}) =>
  entry({
    source: "manual",
    serviceDate: "2026-09-20",
    occurredAt: "2026-09-20T12:00:00.000Z",
    event: null,
    jurisdiction: null,
    creditedBy: { id: OFFICIAL_ID, name: "CivFix", handle: "@civfix", official: true },
    operator: { id: USER_ID, name: "Ops Olu" },
    note: "Staffed the sign-in table",
    ...over,
  })

describe("hours ledger labels", () => {
  it("titles each source", () => {
    expect(hoursEntryTitle(entry())).toBe("Echo Park Lake cleanup")
    expect(hoursEntryTitle(entry({ event: null }))).toBe("Event credit")
    expect(hoursEntryTitle(manual())).toBe("Manual adjustment")
    expect(hoursEntryTitle(entry({ source: "report", event: null }))).toBe("Report credit (retired)")
  })

  it("names the host, or CivFix with the operator behind an official credit", () => {
    expect(hoursEntryCreditor(entry())).toBe("Credited by Maya Host")
    expect(hoursEntryCreditor(manual())).toBe("Credited by CivFix · Ops Olu")
    expect(hoursEntryCreditor(manual({ operator: null }))).toBe("Credited by CivFix")
    expect(hoursEntryCreditor(entry({ creditedBy: null }))).toBeNull()
  })

  it("dates a manual row by its service day, never shifted by the viewer's zone", () => {
    const local = new Date(2026, 8, 20).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    expect(formatServiceDate("2026-09-20")).toBe(local)
    expect(hoursEntryDate(manual({ occurredAt: "2026-01-01T00:00:00.000Z" }))).toBe(local)
    expect(hoursEntryDate(entry())).toBe(formatDate("2026-09-12T17:00:00.000Z"))
  })

  it("joins date, jurisdiction and creditor, skipping what the row lacks", () => {
    expect(hoursEntryMeta(entry())).toEqual([
      formatDate("2026-09-12T17:00:00.000Z"),
      "Los Angeles",
      "Credited by Maya Host",
    ])
    expect(hoursEntryMeta(entry({ jurisdiction: { geoid: "0644000", name: null } }))[1]).toBe("0644000")
    expect(hoursEntryMeta(manual())).toEqual([formatServiceDate("2026-09-20"), "Credited by CivFix · Ops Olu"])
  })

  it("describes a void by whoever is known", () => {
    const voided = { voidedAt: "2026-09-21T10:00:00.000Z", voidable: false }
    expect(hoursEntryVoidDetail(entry())).toBeNull()
    expect(
      hoursEntryVoidDetail(
        entry({ ...voided, voidedBy: { id: USER_ID, name: "Ops Olu" }, voidReason: "Wrong person" }),
      ),
    ).toBe("by Ops Olu: Wrong person")
    expect(hoursEntryVoidDetail(entry({ ...voided, voidedBy: { id: USER_ID, name: "Ops Olu" } }))).toBe(
      "by Ops Olu",
    )
    expect(hoursEntryVoidDetail(entry({ ...voided, source: "report" }))).toBeNull()
  })

  it("formats hours to at most two decimals", () => {
    expect(formatHours(3)).toBe("3")
    expect(formatHours(2.5)).toBe("2.5")
    expect(formatHours(1.256)).toBe("1.26")
    expect(voidedToast("Rosa", 2.5)).toBe("Rosa · 2.5 h voided")
  })

  it("prints an affected certificate in its display form", () => {
    expect(affectedCertificateLine({ code: "A1B2C3D4E5F6", issuedAt: "2026-09-01T12:00:00.000Z" })).toBe(
      `CFX-A1B2-C3D4-E5F6 · issued ${formatDate("2026-09-01T12:00:00.000Z")}`,
    )
  })
})

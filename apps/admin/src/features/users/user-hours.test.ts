import { AppError, ErrorCode, type AdminUserHoursEntryDTO } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import { formatDate } from "@/lib/dates"

import {
  affectedCertificateLine,
  buildCreditRequest,
  creditBlockedReason,
  creditConfirmTitle,
  creditDraftErrors,
  creditServerErrors,
  creditedToast,
  formatHours,
  formatServiceDate,
  hoursEntryCreditor,
  hoursEntryDate,
  hoursEntryMeta,
  hoursEntryTitle,
  hoursEntryVoidDetail,
  serviceDateDraftError,
  todayLocalIsoDate,
  voidedToast,
  type CreditHoursDraft,
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

const EVENT_ID = "00000000-0000-4000-8000-0000000000a1"
const TODAY = "2026-09-26"

function draft(over: Partial<CreditHoursDraft> = {}): CreditHoursDraft {
  return {
    kind: "event",
    event: { id: EVENT_ID, title: "Echo Park Lake cleanup", place: "Echo Park", when: "Sep 12, 2026" },
    hours: "2.5",
    serviceDate: TODAY,
    reason: "  Signed the paper sheet before joining  ",
    ...over,
  }
}

describe("credit hours draft", () => {
  it("reads today from the local calendar, zero-padded", () => {
    expect(todayLocalIsoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05")
    expect(todayLocalIsoDate(new Date(2026, 11, 31, 0, 1))).toBe("2026-12-31")
  })

  it("bounds hours to the contract's range", () => {
    expect(creditDraftErrors(draft({ hours: "0.01" }), TODAY).hours).toBeUndefined()
    expect(creditDraftErrors(draft({ hours: "24" }), TODAY).hours).toBeUndefined()
    expect(creditDraftErrors(draft({ hours: "" }), TODAY).hours).toBe("Enter the hours to credit.")
    for (const bad of ["0", "0.009", "24.01", "-1", "abc", "Infinity"]) {
      expect(creditDraftErrors(draft({ hours: bad }), TODAY).hours).toBe("Enter between 0.01 and 24 hours.")
    }
  })

  it("requires an event for an event credit and a past-or-today date for a manual one", () => {
    expect(creditDraftErrors(draft({ event: null }), TODAY)).toEqual({ event: "Pick the event to credit." })
    expect(creditDraftErrors(draft({ kind: "manual", event: null }), TODAY)).toEqual({})
    expect(creditDraftErrors(draft({ kind: "event", serviceDate: "" }), TODAY)).toEqual({})
    expect(serviceDateDraftError("", TODAY)).toBe("Pick the date of service.")
    expect(serviceDateDraftError("2026-09-27", TODAY)).toBe("The date of service can't be in the future.")
    expect(serviceDateDraftError("1999-12-31", TODAY)).toMatch(/^The date of service must be on or after /)
    expect(serviceDateDraftError(TODAY, TODAY)).toBeNull()
  })

  it("requires a reason that is not only whitespace", () => {
    expect(creditDraftErrors(draft({ reason: "   " }), TODAY)).toEqual({ reason: "A reason is required." })
  })

  it("builds the event member with a trimmed reason and no manual fields", () => {
    expect(buildCreditRequest(USER_ID, draft(), TODAY)).toEqual({
      id: USER_ID,
      kind: "event",
      eventId: EVENT_ID,
      hours: 2.5,
      reason: "Signed the paper sheet before joining",
    })
  })

  it("builds the manual member with the service date and no event", () => {
    expect(
      buildCreditRequest(USER_ID, draft({ kind: "manual", hours: " 3 ", serviceDate: "2026-09-20" }), TODAY),
    ).toEqual({
      id: USER_ID,
      kind: "manual",
      hours: 3,
      serviceDate: "2026-09-20",
      reason: "Signed the paper sheet before joining",
    })
  })

  it("builds nothing while the draft has an error", () => {
    expect(buildCreditRequest(USER_ID, draft({ event: null }), TODAY)).toBeNull()
    expect(buildCreditRequest(USER_ID, draft({ hours: "25" }), TODAY)).toBeNull()
    expect(buildCreditRequest(USER_ID, draft({ kind: "manual", serviceDate: "2026-09-27" }), TODAY)).toBeNull()
  })

  it("words the confirmation and the toast", () => {
    const event = buildCreditRequest(USER_ID, draft({ hours: "3.5" }), TODAY)!
    expect(creditConfirmTitle("Rosa", event, "Echo Park Lake cleanup")).toBe(
      "Credit 3.5 h to Rosa for Echo Park Lake cleanup?",
    )
    const manualRequest = buildCreditRequest(USER_ID, draft({ kind: "manual", serviceDate: "2026-09-20" }), TODAY)!
    expect(creditConfirmTitle("Rosa", manualRequest, null)).toBe(
      `Credit 2.5 h to Rosa as a manual adjustment for ${formatServiceDate("2026-09-20")}?`,
    )
    expect(creditedToast("Rosa", 1.25)).toBe("Rosa · +1.25 h")
  })

  it("blocks deleted and operator accounts", () => {
    expect(creditBlockedReason({ deletedAt: null, role: "citizen" })).toBeNull()
    expect(creditBlockedReason({ deletedAt: "2026-09-01T00:00:00.000Z", role: "citizen" })).toBe(
      "Hours can't be credited to a deleted account.",
    )
    expect(creditBlockedReason({ deletedAt: null, role: "operator" })).toBe(
      "Hours can't be credited to an operator account.",
    )
  })
})

describe("credit hours server errors", () => {
  it("puts validation fields under their inputs", () => {
    const err = new AppError(ErrorCode.VALIDATION, "Invalid request", {
      fields: {
        hours: "this event ran for 2.5 h, so at most 3.5 h may be credited per attendee",
        serviceDate: "The service date can't be in the future.",
      },
    })
    expect(creditServerErrors(err)).toEqual({
      hours: "This event ran for 2.5 h, so at most 3.5 h may be credited per attendee",
      serviceDate: "The service date can't be in the future.",
    })
  })

  it("shows a field the form has no input for on the form, keeping the mapped ones", () => {
    const err = new AppError(ErrorCode.VALIDATION, "Invalid request", {
      fields: { hours: "too many", kind: "Invalid discriminator value" },
    })
    const errors = creditServerErrors(err)
    expect(errors.hours).toBe("Too many")
    expect(errors.form).toBe("The server refused these values. Check each field and try again.")
  })

  it("never returns an empty result for a validation error without usable fields", () => {
    const err = new AppError(ErrorCode.VALIDATION, "Invalid request", { fields: {} })
    expect(creditServerErrors(err)).toEqual({
      form: "The server refused these values. Check each field and try again.",
    })
  })

  it("shows every other refusal on the form with the server's words", () => {
    const err = new AppError(ErrorCode.CONFLICT, "Rosa already holds 2 h for this event; void it first.")
    expect(creditServerErrors(err)).toEqual({
      form: "Rosa already holds 2 h for this event; void it first.",
    })
    expect(creditServerErrors(new AppError(ErrorCode.RATE_LIMITED, ""))).toEqual({
      form: "Too many credits in a short time. Wait a minute and try again.",
    })
  })
})

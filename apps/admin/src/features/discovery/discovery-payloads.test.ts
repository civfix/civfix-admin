import { describe, expect, it } from "vitest"

import {
  contactsPayload,
  jurisdictionFields,
  noteAndHandleFields,
  parseHandle,
  partialSaveMessage,
} from "./discovery-payloads"

describe("contacts payload", () => {
  it("sends trimmed contacts and omits categories that were blank from the start", () => {
    expect(contactsPayload({}, { trash: " trash@city.gov ", graffiti: "", hazard: "   " })).toEqual({
      trash: "trash@city.gov",
    })
  })

  it("sends null for a category the operator emptied, so the server deletes it", () => {
    expect(contactsPayload({ trash: "old@city.gov" }, { trash: "" })).toEqual({ trash: null })
    expect(contactsPayload({ trash: "old@city.gov" }, { trash: "  " })).toEqual({ trash: null })
  })

  it("leaves a category that was blank at load out of the payload, so a contact added meanwhile survives", () => {
    expect(contactsPayload({ trash: "old@city.gov" }, { trash: "old@city.gov", graffiti: "" })).toEqual({
      trash: "old@city.gov",
    })
  })
})

describe("jurisdiction fields", () => {
  it("sends a trimmed default email and form url and omits blanks", () => {
    expect(jurisdictionFields(" reports@city.gov ", " https://city.gov/report ")).toEqual({
      defaultEmails: ["reports@city.gov"],
      formUrl: "https://city.gov/report",
    })
    expect(jurisdictionFields("", "  ")).toEqual({})
  })
})

describe("@handle", () => {
  it("normalizes the way the server does", () => {
    expect(parseHandle("@SF ")).toEqual({ value: "sf", error: null })
    expect(parseHandle("@ sf")).toEqual({ value: "sf", error: null })
    expect(parseHandle("   ")).toEqual({ value: "", error: null })
  })

  it("reports the server's rule for an invalid handle", () => {
    expect(parseHandle("a").error).toBe(
      "Handle must be 2-40 characters using lowercase letters, numbers, or underscores.",
    )
    expect(parseHandle("san francisco").error).not.toBeNull()
  })
})

describe("note and handle fields", () => {
  it("sends a trimmed note and a changed handle", () => {
    expect(noteAndHandleFields(" Called the clerk ", "sf", null)).toEqual({
      notes: "Called the clerk",
      handle: "sf",
    })
  })

  it("omits an empty note and an unchanged handle", () => {
    expect(noteAndHandleFields("  ", "sf", "sf")).toEqual({})
  })

  it("sends an empty handle to clear a stored one", () => {
    expect(noteAndHandleFields("", "", "sf")).toEqual({ handle: "" })
  })
})

describe("partial Save & route message", () => {
  it("names what was saved before the contacts failed", () => {
    expect(partialSaveMessage({ notes: "x" }, "Server down")).toBe(
      "The note was saved, but the contacts were not: Server down",
    )
    expect(partialSaveMessage({ handle: "sf" }, "Server down")).toBe(
      "The @handle was saved, but the contacts were not: Server down",
    )
    expect(partialSaveMessage({ notes: "x", handle: "sf" }, "Server down")).toBe(
      "The note and @handle were saved, but the contacts were not: Server down",
    )
  })
})
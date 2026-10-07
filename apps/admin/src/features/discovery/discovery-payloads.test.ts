import { describe, expect, it } from "vitest"

import {
  afterContactsSaved,
  contactsPayload,
  jurisdictionFields,
  noteAndHandleFields,
  parseHandle,
  partialSaveMessage,
  routingContactsPayload,
  withContactEdit,
} from "./discovery-payloads"

describe("contacts payload", () => {
  it("sends the trimmed contacts the operator edited", () => {
    const current = { trash: " trash@city.gov ", graffiti: "g@city.gov", hazard: "h@city.gov" }
    expect(contactsPayload({ trash: 1, hazard: 2 }, current)).toEqual({
      trash: "trash@city.gov",
      hazard: "h@city.gov",
    })
  })

  it("sends null for an edited category that is now empty, so the server deletes it", () => {
    expect(contactsPayload({ trash: 1 }, { trash: "" })).toEqual({ trash: null })
    expect(contactsPayload({ trash: 1 }, { trash: "  " })).toEqual({ trash: null })
  })

  it("leaves categories the operator did not edit out, so a contact changed meanwhile survives", () => {
    expect(contactsPayload({}, { trash: "old@city.gov", graffiti: "" })).toEqual({})
  })

  it("routes with every contact shown, edited or not, plus null for an edited category now empty", () => {
    const current = { trash: " trash@city.gov ", graffiti: "", hazard: "h@city.gov", dumping: "" }
    expect(routingContactsPayload({ hazard: 1, graffiti: 1 }, current)).toEqual({
      trash: "trash@city.gov",
      hazard: "h@city.gov",
      graffiti: null,
    })
    expect(routingContactsPayload({}, { trash: "old@city.gov" })).toEqual({ trash: "old@city.gov" })
  })

  it("counts every edit to a category", () => {
    expect(withContactEdit(withContactEdit({}, "trash"), "trash")).toEqual({ trash: 2 })
  })

  it("keeps an edit made while the save was in flight marked for the next save", () => {
    expect(afterContactsSaved({ trash: 2, graffiti: 1 }, { trash: 1, graffiti: 1 })).toEqual({ trash: 2 })
    expect(afterContactsSaved({ trash: 1 }, { trash: 1 })).toEqual({})
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
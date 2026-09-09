import { describe, expect, it } from "vitest"

import { ESCAPE_OWNER_SELECTOR, hasEscapeOwner, shellEscapeGoesHome } from "./escape-owner"

/** A document stub that reports a match for the escape-owner selector when `open` is true. */
function doc(open: boolean): Pick<Document, "querySelector"> {
  return {
    querySelector: ((selector: string) =>
      open && selector === ESCAPE_OWNER_SELECTOR ? ({} as Element) : null) as Document["querySelector"],
  }
}

describe("escape ownership", () => {
  it("names the slide-over, the row menu and an open modal dialog", () => {
    expect(ESCAPE_OWNER_SELECTOR).toContain(".panel.open")
    expect(ESCAPE_OWNER_SELECTOR).toContain(".row-menu-pop")
    expect(ESCAPE_OWNER_SELECTOR).toContain('[role="dialog"][aria-modal="true"]')
    expect(ESCAPE_OWNER_SELECTOR).toContain(':not([aria-hidden="true"])')
  })

  it("reports an owner only when one is in the document", () => {
    expect(hasEscapeOwner(doc(true))).toBe(true)
    expect(hasEscapeOwner(doc(false))).toBe(false)
  })
})

describe("shellEscapeGoesHome", () => {
  const base = { key: "Escape", page: "orgs", targetTag: "BUTTON", doc: doc(false) }

  it("goes home on Escape from a section with nothing open", () => {
    expect(shellEscapeGoesHome(base)).toBe(true)
    expect(shellEscapeGoesHome({ ...base, targetTag: undefined })).toBe(true)
  })

  it("stays put while a panel, menu or dialog is open — even with focus on a button", () => {
    expect(shellEscapeGoesHome({ ...base, doc: doc(true) })).toBe(false)
  })

  it("leaves text controls, other keys and the home page alone", () => {
    expect(shellEscapeGoesHome({ ...base, targetTag: "INPUT" })).toBe(false)
    expect(shellEscapeGoesHome({ ...base, targetTag: "TEXTAREA" })).toBe(false)
    expect(shellEscapeGoesHome({ ...base, targetTag: "SELECT" })).toBe(false)
    expect(shellEscapeGoesHome({ ...base, key: "Enter" })).toBe(false)
    expect(shellEscapeGoesHome({ ...base, page: "home" })).toBe(false)
  })
})

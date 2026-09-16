import { describe, expect, it } from "vitest"

import { orgFocus, parseOrgFocus } from "./org-focus"

describe("org focus", () => {
  it("parses a bare id", () => {
    expect(parseOrgFocus("abc")).toEqual({ id: "abc", tab: null })
  })

  it("parses id + tab and round-trips through orgFocus", () => {
    expect(parseOrgFocus(orgFocus("abc", "members"))).toEqual({ id: "abc", tab: "members" })
    expect(orgFocus("abc")).toBe("abc")
  })

  it("ignores an unknown tab and an empty focus", () => {
    expect(parseOrgFocus("abc/bogus")).toEqual({ id: "abc", tab: null })
    expect(parseOrgFocus(null)).toEqual({ id: null, tab: null })
    expect(parseOrgFocus("")).toEqual({ id: null, tab: null })
  })
})

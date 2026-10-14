import { describe, expect, it } from "vitest"

import { userSearchTerm } from "./user-search"

describe("userSearchTerm", () => {
  it("trims the typed text", () => {
    expect(userSearchTerm("  ada ")).toBe("ada")
  })

  it("drops one leading @ so a typed handle matches the stored one", () => {
    expect(userSearchTerm(" @ada ")).toBe("ada")
    expect(userSearchTerm("@@ada")).toBe("@ada")
  })

  it("keeps an @ inside the term", () => {
    expect(userSearchTerm("ada@example")).toBe("ada@example")
  })

  it("returns undefined when nothing is left to search", () => {
    expect(userSearchTerm("")).toBeUndefined()
    expect(userSearchTerm("   ")).toBeUndefined()
    expect(userSearchTerm(" @ ")).toBeUndefined()
  })
})

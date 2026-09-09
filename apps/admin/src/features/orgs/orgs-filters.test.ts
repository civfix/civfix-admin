import { describe, expect, it } from "vitest"

import { ORG_FILTERS, orgFilterCount, orgListParams } from "./orgs-filters"

describe("organization list filters", () => {
  it("sends no facet for the all chip", () => {
    expect(orgListParams("all")).toEqual({})
    expect(orgListParams("all", "   ")).toEqual({})
  })

  it("maps each verification status onto the verified facet", () => {
    expect(orgListParams("pending")).toEqual({ verified: "pending" })
    expect(orgListParams("verified")).toEqual({ verified: "verified" })
    expect(orgListParams("rejected")).toEqual({ verified: "rejected" })
    expect(orgListParams("unverified")).toEqual({ verified: "unverified" })
  })

  it("maps the suspended chip onto the orthogonal suspended flag", () => {
    expect(orgListParams("suspended")).toEqual({ suspended: true })
  })

  it("trims the search and combines it with the facet", () => {
    expect(orgListParams("verified", "  Griffith ")).toEqual({ verified: "verified", q: "Griffith" })
    expect(orgListParams("all", "park")).toEqual({ q: "park" })
  })

  it("ignores an unknown chip rather than sending it to the server", () => {
    expect(orgListParams("bogus")).toEqual({})
    expect(orgListParams("bogus", "x")).toEqual({ q: "x" })
  })

  it("reads chip counts from the page-one counts and leaves uncounted facets blank", () => {
    const counts = { all: 12, verified: 5, pending: 3, suspended: 1 }
    expect(orgFilterCount(counts, "all")).toBe(12)
    expect(orgFilterCount(counts, "pending")).toBe(3)
    expect(orgFilterCount(counts, "verified")).toBe(5)
    expect(orgFilterCount(counts, "suspended")).toBe(1)
    expect(orgFilterCount(counts, "rejected")).toBeUndefined()
    expect(orgFilterCount(counts, "unverified")).toBeUndefined()
    expect(orgFilterCount(undefined, "all")).toBeUndefined()
  })

  it("offers the pending queue as a chip so the old workflow survives", () => {
    expect(ORG_FILTERS).toContain("pending")
  })
})

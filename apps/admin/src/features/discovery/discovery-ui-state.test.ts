import { describe, expect, it } from "vitest"

import { EMPTY_VALUE } from "@/lib/empty-value"
import {
  getCountDisplay,
  getJurisdictionSort,
  initialDirectoryState,
  pickSelected,
} from "./discovery-ui-state"

describe("Jurisdictions UI state", () => {
  it("always uses oldest sort for the Needs mapping filter", () => {
    expect(getJurisdictionSort("attention", "pop")).toBe("oldest")
    expect(getJurisdictionSort("attention", "reports")).toBe("oldest")
    expect(getJurisdictionSort("attention", "oldest")).toBe("oldest")
  })

  it("shows loading and unavailable count labels instead of false zeroes", () => {
    expect(getCountDisplay({ count: null, isLoading: true, isError: false })).toBe("Loading…")
    expect(getCountDisplay({ count: null, isLoading: false, isError: true })).toBe(EMPTY_VALUE)
    expect(getCountDisplay({ count: 0, isLoading: false, isError: false })).toBe(0)
  })
})

describe("initial directory state", () => {
  it("opens on Needs mapping with an empty search", () => {
    expect(initialDirectoryState(null)).toEqual({ filter: "attention", query: "" })
  })

  it("opens a deep link on All with its geoid as the search, since a bounced or routed place is never in Needs mapping", () => {
    expect(initialDirectoryState("0667000")).toEqual({ filter: "all", query: "0667000" })
  })
})

describe("selected jurisdiction", () => {
  const la = { geoid: "0644000" }
  const sf = { geoid: "0667000" }

  it("shows no row while nothing is selected, so a cleared pick never falls to another row", () => {
    expect(pickSelected([la, sf], null, null)).toBeNull()
    expect(pickSelected([la, sf], null, la)).toBeNull()
  })

  it("shows the selected row from the list", () => {
    expect(pickSelected([la, sf], "0667000", null)).toBe(sf)
  })

  it("keeps showing the selected row after it leaves the list", () => {
    expect(pickSelected([la], "0667000", sf)).toBe(sf)
  })

  it("never falls back to another row for a selection it has not seen", () => {
    expect(pickSelected([la], "0667000", null)).toBeNull()
    expect(pickSelected([la], "0667000", la)).toBeNull()
  })
})
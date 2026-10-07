import { hashKey } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import { EMPTY_VALUE } from "@/lib/empty-value"

import { directoryCounts, toDirectoryQuery } from "./discovery-ui-state"

describe("directory query", () => {
  it.each([
    ["attention", "pop", { filter: "needs_mapping", sort: "oldest" }],
    ["clear", "pop", { filter: "routed", sort: "population" }],
    ["all", "reports", { filter: "all", sort: "reports" }],
    ["all", "oldest", { filter: "all", sort: "oldest" }],
  ] as const)("maps %s sorted by %s", (filter, sort, expected) => {
    expect(toDirectoryQuery(filter, sort, "all", "")).toEqual(expected)
  })

  it("adds the layer and search only when set", () => {
    expect(toDirectoryQuery("all", "pop", "county", "06")).toEqual({
      filter: "all",
      sort: "population",
      layer: "county",
      q: "06",
    })
    expect(hashKey([toDirectoryQuery("all", "pop", "all", "")])).toBe(
      hashKey([{ filter: "all", sort: "population" }]),
    )
  })
})

describe("directory counts", () => {
  const list = { isLoading: false, isError: false }

  it("splits the facets across the chips and heads the list with the active filter's count", () => {
    const counts = directoryCounts({
      filter: "clear",
      total: 12,
      facets: { routed: 5, unrouted: 7 },
      needsMapping: 3,
      list,
      loadedCount: 2,
    })
    expect(counts).toEqual({ chips: { attention: 3, clear: 5, all: 12 }, header: 5 })
  })

  it("heads Needs mapping with its own count query", () => {
    const counts = directoryCounts({
      filter: "attention",
      total: 40,
      facets: null,
      needsMapping: "Loading…",
      list,
      loadedCount: 0,
    })
    expect(counts.header).toBe("Loading…")
    expect(counts.chips.all).toBe(EMPTY_VALUE)
  })

  it("falls back to the loaded rows when the server sent no total", () => {
    const counts = directoryCounts({
      filter: "all",
      total: null,
      facets: null,
      needsMapping: 0,
      list,
      loadedCount: 4,
    })
    expect(counts.header).toBe(4)
  })
})

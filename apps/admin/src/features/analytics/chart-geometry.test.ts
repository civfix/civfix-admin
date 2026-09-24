import { describe, expect, it } from "vitest"

import { barHeightPcts, barValueLabel, sparkHeightPcts } from "./chart-geometry"

describe("bar chart geometry", () => {
  it("scales every bar against the tallest one", () => {
    expect(barHeightPcts([2, 4, 1])).toEqual([50, 100, 25])
  })

  it("keeps an all-zero series at zero height instead of dividing by zero", () => {
    expect(barHeightPcts([0, 0])).toEqual([0, 0])
  })

  it("returns no heights for an empty series", () => {
    expect(barHeightPcts([])).toEqual([])
  })

  it("abbreviates values from one thousand up", () => {
    expect(barValueLabel(999)).toBe("999")
    expect(barValueLabel(1000)).toBe("1.0k")
    expect(barValueLabel(1540)).toBe("1.5k")
  })
})

describe("sparkline geometry", () => {
  it("spans the floor to the top between the smallest and largest value", () => {
    expect(sparkHeightPcts([1, 3, 2])).toEqual([10, 98, 54])
  })

  it("draws a flat series at the floor height", () => {
    expect(sparkHeightPcts([5, 5, 5])).toEqual([10, 10, 10])
  })

  it("draws a single value at the floor height", () => {
    expect(sparkHeightPcts([7])).toEqual([10])
  })

  it("returns no heights for an empty series", () => {
    expect(sparkHeightPcts([])).toEqual([])
  })
})

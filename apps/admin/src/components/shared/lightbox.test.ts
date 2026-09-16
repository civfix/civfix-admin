import { describe, it, expect } from "vitest"

import { startIndex, stepIndex } from "@/components/shared/lightbox"

describe("lightbox paging", () => {
  it("wraps forward past the last photo and backward past the first", () => {
    expect(stepIndex(0, 1, 3)).toBe(1)
    expect(stepIndex(2, 1, 3)).toBe(0)
    expect(stepIndex(0, -1, 3)).toBe(2)
    expect(stepIndex(1, -1, 3)).toBe(0)
  })

  it("stays put on a single photo and never divides by an empty set", () => {
    expect(stepIndex(0, 1, 1)).toBe(0)
    expect(stepIndex(0, -1, 1)).toBe(0)
    expect(stepIndex(0, 1, 0)).toBe(0)
  })

  it("clamps an out-of-range start to the first photo", () => {
    expect(startIndex(2, 4)).toBe(2)
    expect(startIndex(-1, 4)).toBe(0)
    expect(startIndex(4, 4)).toBe(0)
  })
})

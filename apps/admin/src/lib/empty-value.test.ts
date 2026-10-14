import { describe, expect, it } from "vitest"

import { formatDate } from "./dates"
import { EMPTY_VALUE } from "./empty-value"

describe("EMPTY_VALUE", () => {
  it("is a plain hyphen, also for an empty date", () => {
    expect(EMPTY_VALUE).toBe("-")
    expect(formatDate(null)).toBe("-")
  })
})

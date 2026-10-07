import { describe, expect, it } from "vitest"

import { canDecideVerification } from "./org-verification"

describe("canDecideVerification", () => {
  it("allows a decision only on a pending application", () => {
    expect(canDecideVerification({ verifiedStatus: "pending", deletedAt: null })).toBe(true)
    expect(canDecideVerification({ verifiedStatus: "verified", deletedAt: null })).toBe(false)
    expect(canDecideVerification({ verifiedStatus: "rejected", deletedAt: null })).toBe(false)
    expect(canDecideVerification({ verifiedStatus: "unverified", deletedAt: null })).toBe(false)
  })

  it("refuses a decision on a deleted organization", () => {
    expect(
      canDecideVerification({ verifiedStatus: "pending", deletedAt: "2026-04-01T10:00:00.000Z" }),
    ).toBe(false)
  })
})

import { describe, expect, it } from "vitest"

import { userStatusActions } from "./user-status-actions"

describe("userStatusActions", () => {
  it("lets an active account be suspended or banned, not reactivated", () => {
    expect(userStatusActions({ status: "active", deletedAt: null })).toEqual({
      flag: true,
      verifyReports: true,
      reactivate: false,
      suspend: true,
      ban: true,
    })
  })

  it("offers reactivation for a suspended account and keeps ban available", () => {
    expect(userStatusActions({ status: "suspended", deletedAt: null })).toMatchObject({
      reactivate: true,
      suspend: false,
      ban: true,
    })
  })

  it("offers only reactivation for a banned account", () => {
    expect(userStatusActions({ status: "banned", deletedAt: null })).toMatchObject({
      reactivate: true,
      suspend: false,
      ban: false,
    })
  })

  it("neither suspends nor reactivates an account under review", () => {
    expect(userStatusActions({ status: "review", deletedAt: null })).toMatchObject({
      reactivate: false,
      suspend: false,
      ban: true,
    })
  })

  it("turns every account action off for a self-deleted account", () => {
    expect(userStatusActions({ status: "banned", deletedAt: "2026-01-01T00:00:00Z" })).toEqual({
      flag: false,
      verifyReports: false,
      reactivate: false,
      suspend: false,
      ban: false,
    })
  })
})

import { describe, expect, it } from "vitest"

import { getReporterProfileId } from "./reporter-navigation"

describe("getReporterProfileId", () => {
  it("returns no destination for anonymous ids and preserves actual user ids", () => {
    expect(getReporterProfileId(null)).toBeNull()
    expect(getReporterProfileId("")).toBeNull()
    expect(getReporterProfileId("   ")).toBeNull()
    expect(getReporterProfileId("USER-1")).toBe("USER-1")
  })
})

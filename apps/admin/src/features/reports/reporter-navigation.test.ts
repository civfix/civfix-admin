import { describe, expect, it } from "vitest"

import { toReporterProfileId } from "./reporter-navigation"

describe("toReporterProfileId", () => {
  it("returns no destination for anonymous ids and preserves actual user ids", () => {
    expect(toReporterProfileId(null)).toBeNull()
    expect(toReporterProfileId("")).toBeNull()
    expect(toReporterProfileId("   ")).toBeNull()
    expect(toReporterProfileId("USER-1")).toBe("USER-1")
  })
})

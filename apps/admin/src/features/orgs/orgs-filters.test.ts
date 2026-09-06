import { describe, expect, it } from "vitest"

import { orgStatusFilterParam } from "./orgs-filters"

describe("organization queue filters", () => {
  it("sends no status for the all chip", () => {
    expect(orgStatusFilterParam("all")).toBeUndefined()
  })

  it("passes each verification status straight through", () => {
    expect(orgStatusFilterParam("pending")).toBe("pending")
    expect(orgStatusFilterParam("verified")).toBe("verified")
    expect(orgStatusFilterParam("rejected")).toBe("rejected")
    expect(orgStatusFilterParam("unverified")).toBe("unverified")
  })

  it("ignores an unknown chip rather than sending it to the server", () => {
    expect(orgStatusFilterParam("bogus")).toBeUndefined()
  })
})

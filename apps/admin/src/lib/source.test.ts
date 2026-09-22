import { describe, expect, it } from "vitest"
import { SOURCE_REPO_URL, sourceLink } from "./source"

describe("the AGPL source link", () => {
  it("points at the repository root when no commit is known", () => {
    expect(sourceLink(undefined)).toEqual({ commit: "", url: SOURCE_REPO_URL })
    expect(sourceLink("")).toEqual({ commit: "", url: SOURCE_REPO_URL })
  })

  it("links the exact deployed tree for a commit sha, normalized to lowercase", () => {
    const sha = "ABCDEF1234567890abcdef1234567890abcdef12"
    expect(sourceLink(sha)).toEqual({
      commit: sha.toLowerCase(),
      url: `${SOURCE_REPO_URL}/tree/${sha.toLowerCase()}`,
    })
    expect(sourceLink("abc1234").url).toBe(`${SOURCE_REPO_URL}/tree/abc1234`)
  })

  it("refuses anything that is not a commit sha, so a bad build value cannot forge the link", () => {
    for (const bad of ["main", "abc", "../../evil", "abc1234; rm -rf", "g".repeat(40)]) {
      expect(sourceLink(bad), bad).toEqual({ commit: "", url: SOURCE_REPO_URL })
    }
  })
})

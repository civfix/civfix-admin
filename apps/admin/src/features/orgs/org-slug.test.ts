import { describe, expect, it } from "vitest"

import { deriveSlug, publicOrgUrl, slugProblem } from "./org-slug"

describe("deriveSlug", () => {
  it("lowercases and kebab-cases a name", () => {
    expect(deriveSlug("Friends of Griffith Park")).toBe("friends-of-griffith-park")
  })

  it("collapses punctuation runs into a single hyphen and trims the ends", () => {
    expect(deriveSlug("  LA -- River!! Cleanup  ")).toBe("la-river-cleanup")
    expect(deriveSlug("Parks & Rec")).toBe("parks-and-rec")
  })

  it("folds accents to ASCII", () => {
    expect(deriveSlug("Café São João")).toBe("cafe-sao-joao")
  })

  it("caps at 40 characters without a dangling hyphen", () => {
    const slug = deriveSlug("The Very Long Organization Name That Goes On And On Forever")
    expect(slug.length).toBeLessThanOrEqual(40)
    expect(slug.endsWith("-")).toBe(false)
    expect(slug).toBe("the-very-long-organization-name-that-goe")
  })

  it("returns an empty string when nothing survives", () => {
    expect(deriveSlug("!!!")).toBe("")
  })
})

describe("slugProblem", () => {
  it("accepts a valid slug", () => {
    expect(slugProblem("friends-of-griffith-park")).toBeNull()
    expect(slugProblem("abc")).toBeNull()
    expect(slugProblem("a1-b2")).toBeNull()
  })

  it("explains each rejection the schema would make", () => {
    expect(slugProblem("")).toMatch(/required/)
    expect(slugProblem("la")).toMatch(/At least 3/)
    expect(slugProblem("x".repeat(41))).toMatch(/At most 40/)
    expect(slugProblem("Friends")).toMatch(/Lowercase/)
    expect(slugProblem("friends park")).toMatch(/letters, digits and hyphens/)
    expect(slugProblem("-friends")).toMatch(/start or end/)
    expect(slugProblem("friends--park")).toMatch(/consecutive/)
  })
})

describe("publicOrgUrl", () => {
  it("points at the public org page", () => {
    expect(publicOrgUrl("friends-of-griffith-park")).toBe(
      "https://civfix.org/orgs/friends-of-griffith-park",
    )
  })
})

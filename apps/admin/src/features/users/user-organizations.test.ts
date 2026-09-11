import { describe, expect, it } from "vitest"

import {
  userOrganizationFocus,
  userOrganizationsView,
  type UserOrganization,
} from "./user-organizations"

const org = (name: string, role: UserOrganization["role"]): UserOrganization => ({
  id: `id-${name}`,
  slug: name.toLowerCase(),
  name,
  role,
})

describe("userOrganizationsView", () => {
  it("reports nothing when the server omitted the additive field", () => {
    expect(userOrganizationsView(undefined)).toEqual({ reported: false, items: [] })
  })

  it("distinguishes an explicit empty list from an absent one", () => {
    expect(userOrganizationsView([])).toEqual({ reported: true, items: [] })
  })

  it("orders owner, then admin, then member, and alphabetically within a role", () => {
    const input = [
      org("Zebra", "member"),
      org("Alder", "member"),
      org("Basin", "owner"),
      org("Creek", "admin"),
    ]
    expect(userOrganizationsView(input).items.map((o) => o.name)).toEqual([
      "Basin",
      "Creek",
      "Alder",
      "Zebra",
    ])
  })

  it("does not mutate the response array", () => {
    const input = [org("Zebra", "member"), org("Basin", "owner")]
    userOrganizationsView(input)
    expect(input.map((o) => o.name)).toEqual(["Zebra", "Basin"])
  })
})

describe("userOrganizationFocus", () => {
  it("points the orgs section at the organization's detail", () => {
    expect(userOrganizationFocus({ id: "org-1" })).toBe("org-1")
  })
})

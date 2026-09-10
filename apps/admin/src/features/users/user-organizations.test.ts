import { describe, expect, it } from "vitest"

import {
  sortUserOrganizations,
  userOrganizationFocus,
  type UserOrganization,
} from "./user-organizations"

const org = (name: string, role: UserOrganization["role"]): UserOrganization => ({
  id: `id-${name}`,
  slug: name.toLowerCase(),
  name,
  role,
})

describe("sortUserOrganizations", () => {
  it("returns an empty list when the server sent no memberships", () => {
    expect(sortUserOrganizations(undefined)).toEqual([])
    expect(sortUserOrganizations([])).toEqual([])
  })

  it("orders owner, then admin, then member, and alphabetically within a role", () => {
    const input = [
      org("Zebra", "member"),
      org("Alder", "member"),
      org("Basin", "owner"),
      org("Creek", "admin"),
    ]
    expect(sortUserOrganizations(input).map((o) => o.name)).toEqual([
      "Basin",
      "Creek",
      "Alder",
      "Zebra",
    ])
  })

  it("does not mutate the response array", () => {
    const input = [org("Zebra", "member"), org("Basin", "owner")]
    sortUserOrganizations(input)
    expect(input.map((o) => o.name)).toEqual(["Zebra", "Basin"])
  })
})

describe("userOrganizationFocus", () => {
  it("points the orgs section at the organization's detail", () => {
    expect(userOrganizationFocus({ id: "org-1" })).toBe("org-1")
  })
})

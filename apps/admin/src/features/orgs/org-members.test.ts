import { describe, expect, it } from "vitest"

import { canRemoveMember, menuFocusIndex, roleChangeCopy, roleTargets } from "./org-members"

describe("member role rules", () => {
  it("offers every role but the current one, including an ownership transfer", () => {
    expect(roleTargets("member")).toEqual(["owner", "admin"])
    expect(roleTargets("admin")).toEqual(["owner", "member"])
    expect(roleTargets("owner")).toEqual(["admin", "member"])
  })

  it("never lets the owner row be removed", () => {
    expect(canRemoveMember("owner")).toBe(false)
    expect(canRemoveMember("admin")).toBe(true)
    expect(canRemoveMember("member")).toBe(true)
  })
})

describe("roleChangeCopy", () => {
  it("spells out an ownership transfer and the old owner's demotion", () => {
    const copy = roleChangeCopy({
      memberName: "Ada",
      from: "admin",
      to: "owner",
      orgName: "River Friends",
      currentOwnerName: "Grace",
    })
    expect(copy.transfer).toBe(true)
    expect(copy.title).toBe("Transfer ownership of River Friends to Ada?")
    expect(copy.body).toContain("exactly one owner")
    expect(copy.body).toContain("Grace becomes an admin")
    expect(copy.confirmLabel).toBe("Transfer ownership")
  })

  it("falls back to generic wording when the current owner is unknown", () => {
    const copy = roleChangeCopy({ memberName: "Ada", from: "member", to: "owner", orgName: "X" })
    expect(copy.body).toContain("the current owner becomes an admin")
  })

  it("tells the operator to transfer first when demoting the owner, with nothing to confirm", () => {
    const copy = roleChangeCopy({ memberName: "Grace", from: "owner", to: "member", orgName: "X" })
    expect(copy.transfer).toBe(false)
    expect(copy.body).toContain("transfer ownership to another member first")
    expect(copy.confirmLabel).toBeUndefined()
  })

  it("describes a plain promotion or demotion", () => {
    expect(
      roleChangeCopy({ memberName: "Ada", from: "member", to: "admin", orgName: "X" }).title,
    ).toBe("Make Ada an admin of X?")
    expect(
      roleChangeCopy({ memberName: "Ada", from: "admin", to: "member", orgName: "X" }).confirmLabel,
    ).toBe("Make member")
  })
})

describe("menuFocusIndex", () => {
  it("moves with the arrows and wraps at both ends", () => {
    expect(menuFocusIndex("ArrowDown", -1, 3)).toBe(0)
    expect(menuFocusIndex("ArrowDown", 0, 3)).toBe(1)
    expect(menuFocusIndex("ArrowDown", 2, 3)).toBe(0)
    expect(menuFocusIndex("ArrowUp", -1, 3)).toBe(2)
    expect(menuFocusIndex("ArrowUp", 0, 3)).toBe(2)
    expect(menuFocusIndex("ArrowUp", 2, 3)).toBe(1)
  })

  it("jumps with Home and End and ignores other keys", () => {
    expect(menuFocusIndex("Home", 2, 3)).toBe(0)
    expect(menuFocusIndex("End", 0, 3)).toBe(2)
    expect(menuFocusIndex("Enter", 0, 3)).toBeNull()
    expect(menuFocusIndex("ArrowDown", 0, 0)).toBeNull()
  })

  it("answers only the arrows of its orientation", () => {
    expect(menuFocusIndex("ArrowRight", 0, 3)).toBeNull()
    expect(menuFocusIndex("ArrowRight", 0, 3, "horizontal")).toBe(1)
    expect(menuFocusIndex("ArrowLeft", 0, 3, "horizontal")).toBe(2)
    expect(menuFocusIndex("ArrowDown", 0, 3, "horizontal")).toBeNull()
    expect(menuFocusIndex("End", 0, 3, "horizontal")).toBe(2)
    expect(menuFocusIndex("ArrowDown", 0, 2, "both")).toBe(1)
    expect(menuFocusIndex("ArrowRight", 1, 2, "both")).toBe(0)
    expect(menuFocusIndex("ArrowUp", 0, 2, "both")).toBe(1)
    expect(menuFocusIndex("ArrowLeft", 1, 2, "both")).toBe(0)
  })
})

import { describe, expect, it } from "vitest"
import { AppError, ErrorCode, type AdminOrgDTO } from "@civfix/shared"

import {
  buildCreateRequest,
  buildUpdateRequest,
  draftFromOrg,
  emptyProfileDraft,
  fieldErrorsFromError,
  socialLinksFromDraft,
  validateProfileDraft,
} from "./org-form"

const org: AdminOrgDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "river-friends",
  name: "River Friends",
  description: "We clean the river.",
  websiteUrl: "https://river.example.org",
  logoUrl: null,
  verifiedStatus: "verified",
  verifiedKind: "nonprofit",
  createdAt: "2026-01-01T00:00:00.000Z",
  memberCount: 3,
  eventCount: 2,
  donationsEnabled: false,
  socialLinks: { instagram: "riverfriends" },
}

describe("validateProfileDraft", () => {
  it("requires a name and a valid slug", () => {
    const errors = validateProfileDraft(emptyProfileDraft())
    expect(errors.name).toMatch(/required/)
    expect(errors.slug).toMatch(/required/)
  })

  it("accepts a complete draft", () => {
    expect(validateProfileDraft(draftFromOrg(org))).toEqual({})
  })

  it("rejects a non-https website and a bad social handle", () => {
    const draft = draftFromOrg(org)
    draft.websiteUrl = "http://river.example.org"
    draft.social.x = "has space"
    draft.social.whatsapp = "0123"
    const errors = validateProfileDraft(draft)
    expect(errors.websiteUrl).toMatch(/https/)
    expect(errors.x).toBeDefined()
    expect(errors.whatsapp).toBeDefined()
  })
})

describe("socialLinksFromDraft", () => {
  it("strips a leading @ and drops blank platforms, null when all blank", () => {
    const draft = emptyProfileDraft()
    expect(socialLinksFromDraft(draft.social)).toBeNull()
    draft.social.instagram = "@river"
    draft.social.x = "  "
    expect(socialLinksFromDraft(draft.social)).toEqual({ instagram: "river" })
  })
})

describe("buildCreateRequest", () => {
  it("omits empty optionals and includes the verification shortcut when chosen", () => {
    const draft = emptyProfileDraft()
    draft.name = " River Friends "
    draft.slug = "River-Friends"
    const req = buildCreateRequest(draft, {
      ownerUserId: "u1",
      verifiedKind: "government",
      reason: " onboarded ",
    })
    expect(req).toEqual({
      name: "River Friends",
      slug: "river-friends",
      ownerUserId: "u1",
      verifiedKind: "government",
      reason: "onboarded",
    })
  })
})

describe("buildUpdateRequest", () => {
  it("returns null when nothing changed", () => {
    expect(buildUpdateRequest(org, draftFromOrg(org), "r")).toBeNull()
  })

  it("sends only the changed fields and null for a cleared optional", () => {
    const draft = draftFromOrg(org)
    draft.name = "River Friends LA"
    draft.websiteUrl = ""
    draft.social.instagram = ""
    expect(buildUpdateRequest(org, draft, "fix")).toEqual({
      id: org.id,
      reason: "fix",
      name: "River Friends LA",
      websiteUrl: null,
      socialLinks: null,
    })
  })

  it("treats a slug change as a change", () => {
    const draft = draftFromOrg(org)
    draft.slug = "river-friends-la"
    expect(buildUpdateRequest(org, draft, "r")?.slug).toBe("river-friends-la")
  })
})

describe("fieldErrorsFromError", () => {
  it("maps a conflict to the slug", () => {
    expect(fieldErrorsFromError(new AppError(ErrorCode.CONFLICT, "slug taken"))).toEqual({
      slug: "This slug is already taken.",
    })
  })

  it("maps VALIDATION.fields onto the form fields it knows", () => {
    const err = AppError.validation({
      name: "too long",
      "socialLinks.x": "bad handle",
      ownerUserId: "unknown user",
      somethingElse: "ignored",
    })
    expect(fieldErrorsFromError(err)).toEqual({
      name: "too long",
      x: "bad handle",
      ownerUserId: "unknown user",
    })
  })

  it("returns nothing for other errors so the toast handles them", () => {
    expect(fieldErrorsFromError(new AppError(ErrorCode.FORBIDDEN, "no"))).toEqual({})
    expect(fieldErrorsFromError(new Error("network"))).toEqual({})
  })
})

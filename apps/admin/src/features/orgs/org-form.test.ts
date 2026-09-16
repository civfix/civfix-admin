import { describe, expect, it } from "vitest"
import { AppError, ErrorCode, type AdminOrgDTO, type AdminUpdateOrgRequest } from "@civfix/shared"

import {
  buildCreateRequest,
  buildUpdateRequest,
  clearChangedFieldErrors,
  draftFromOrg,
  emptyProfileDraft,
  fieldErrorsFromError,
  pickFieldErrors,
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
  socialLinks: { instagram: "riverfriends" },
  logoMediaId: null,
}

const LOGO_A = "22222222-2222-4222-8222-222222222222"
const LOGO_B = "33333333-3333-4333-8333-333333333333"

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

  it("sends an uploaded logo and omits the key when none was chosen", () => {
    const draft = emptyProfileDraft()
    draft.name = "River Friends"
    draft.slug = "river-friends"
    const opts = { ownerUserId: "u1", verifiedKind: null, reason: "r" }
    expect(buildCreateRequest(draft, opts).logoMediaId).toBeUndefined()
    draft.logoMediaId = LOGO_A
    draft.logoPreviewUrl = "blob:preview"
    expect(buildCreateRequest(draft, opts).logoMediaId).toBe(LOGO_A)
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

  it("sends the new logo id, null when cleared, and nothing when untouched", () => {
    const withLogo: AdminOrgDTO = { ...org, logoMediaId: LOGO_A, logoUrl: "https://cdn/logo.png" }
    expect(buildUpdateRequest(withLogo, draftFromOrg(withLogo), "r")).toBeNull()

    const replaced = draftFromOrg(withLogo)
    replaced.logoMediaId = LOGO_B
    replaced.logoPreviewUrl = "blob:preview"
    expect(buildUpdateRequest(withLogo, replaced, "r")).toEqual({
      id: org.id,
      reason: "r",
      logoMediaId: LOGO_B,
    })

    const cleared = draftFromOrg(withLogo)
    cleared.logoMediaId = null
    cleared.logoPreviewUrl = null
    expect(buildUpdateRequest(withLogo, cleared, "r")).toEqual({
      id: org.id,
      reason: "r",
      logoMediaId: null,
    })

    const added = draftFromOrg(org)
    added.logoMediaId = LOGO_A
    expect(buildUpdateRequest(org, added, "r")).toEqual({
      id: org.id,
      reason: "r",
      logoMediaId: LOGO_A,
    })
  })

  it("does not treat a preview-only change as dirty", () => {
    const draft = draftFromOrg(org)
    draft.logoPreviewUrl = "blob:preview"
    expect(buildUpdateRequest(org, draft, "r")).toBeNull()
  })

  it("treats a slug change as a change", () => {
    const draft = draftFromOrg(org)
    draft.slug = "river-friends-la"
    expect(buildUpdateRequest(org, draft, "r")?.slug).toBe("river-friends-la")
  })

  it("compares trimmed against trimmed, so stored whitespace is not a change", () => {
    const padded: AdminOrgDTO = {
      ...org,
      name: " River Friends ",
      description: "We clean the river.\n",
      websiteUrl: " https://river.example.org",
    }
    // The draft mirrors the org verbatim: nothing to send.
    expect(buildUpdateRequest(padded, draftFromOrg(padded), "r")).toBeNull()
    // Typing surrounding whitespace into the draft is not a change either.
    const draft = draftFromOrg(org)
    draft.name = `  ${org.name}  `
    draft.description = `${org.description}\n\n`
    draft.websiteUrl = ` ${org.websiteUrl} `
    expect(buildUpdateRequest(org, draft, "r")).toBeNull()
    // A real edit next to a padded field only sends the edited key.
    draft.description = "We clean the river, weekly."
    expect(buildUpdateRequest(org, draft, "r")).toEqual({
      id: org.id,
      reason: "r",
      description: "We clean the river, weekly.",
    })
  })
})

describe("fieldErrorsFromError", () => {
  it("maps a conflict to the slug", () => {
    expect(fieldErrorsFromError(new AppError(ErrorCode.CONFLICT, "slug taken"))).toEqual({
      slug: "This slug is already taken.",
    })
  })

  it("maps a conflict to the slug only when the request carried one", () => {
    const conflict = new AppError(ErrorCode.CONFLICT, "conflict")
    expect(fieldErrorsFromError(conflict, { slug: "river-friends" })).toEqual({
      slug: "This slug is already taken.",
    })
    const noSlug: AdminUpdateOrgRequest = { id: org.id, reason: "r", name: "X" }
    expect(fieldErrorsFromError(conflict, noSlug)).toEqual({})
  })

  it("maps VALIDATION.fields onto the form fields it knows", () => {
    const err = AppError.validation({
      name: "too long",
      "socialLinks.x": "bad handle",
      logoMediaId: "That image is unavailable.",
      ownerUserId: "unknown user",
      somethingElse: "ignored",
    })
    expect(fieldErrorsFromError(err)).toEqual({
      name: "too long",
      x: "bad handle",
      logoMediaId: "That image is unavailable.",
      ownerUserId: "unknown user",
    })
  })

  it("returns nothing for other errors so the toast handles them", () => {
    expect(fieldErrorsFromError(new AppError(ErrorCode.FORBIDDEN, "no"))).toEqual({})
    expect(fieldErrorsFromError(new Error("network"))).toEqual({})
  })
})

describe("clearChangedFieldErrors", () => {
  const errors = { name: "too long", slug: "taken", x: "bad handle", ownerUserId: "unknown" }

  it("drops the errors of the fields that changed and keeps the rest", () => {
    const prev = draftFromOrg(org)
    const next = { ...prev, slug: "river-friends-la", social: { ...prev.social, x: "river" } }
    expect(clearChangedFieldErrors(errors, prev, next)).toEqual({
      name: "too long",
      ownerUserId: "unknown",
    })
  })

  it("returns the same object when no errored field changed", () => {
    const prev = draftFromOrg(org)
    const next = { ...prev, description: "edited" }
    expect(clearChangedFieldErrors(errors, prev, next)).toBe(errors)
  })

  it("drops a logo error once a new image is picked", () => {
    const prev = draftFromOrg(org)
    const next = { ...prev, logoMediaId: LOGO_A }
    expect(
      clearChangedFieldErrors({ logoMediaId: "That image is unavailable." }, prev, next),
    ).toEqual({})
  })
})

describe("pickFieldErrors", () => {
  it("keeps only the keys a form renders", () => {
    expect(pickFieldErrors({ name: "a", reason: "b", ownerUserId: "c" }, ["name", "slug"])).toEqual({
      name: "a",
    })
  })
})

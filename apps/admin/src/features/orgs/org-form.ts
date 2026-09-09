import {
  ErrorCode,
  HttpsUrlSchema,
  MAX_ORG_DESCRIPTION,
  MAX_ORG_NAME,
  SOCIAL_PLATFORMS,
  SocialLinksSchema,
  type AdminCreateOrgRequest,
  type AdminOrgDTO,
  type AdminUpdateOrgRequest,
  type OrgVerificationKind,
  type SocialLinks,
  type SocialPlatform,
} from "@civfix/shared"

import { toAppError } from "@/lib/api"
import { slugProblem } from "@/features/orgs/org-slug"

export { MAX_ORG_DESCRIPTION, MAX_ORG_NAME, SOCIAL_PLATFORMS }
export type { SocialPlatform }

/** The editable profile fields, as the form holds them (strings; "" means empty). */
export interface OrgProfileDraft {
  name: string
  slug: string
  description: string
  websiteUrl: string
  social: Record<SocialPlatform, string>
}

export type OrgProfileField = "name" | "slug" | "description" | "websiteUrl" | SocialPlatform
export type OrgProfileErrors = Partial<Record<OrgProfileField | "ownerUserId" | "reason", string>>

export const SOCIAL_PLACEHOLDER: Record<SocialPlatform, string> = {
  facebook: "pagename",
  instagram: "handle",
  tiktok: "handle",
  x: "handle",
  whatsapp: "12135550123",
}

export function emptySocial(): Record<SocialPlatform, string> {
  return { facebook: "", instagram: "", tiktok: "", x: "", whatsapp: "" }
}

export function emptyProfileDraft(): OrgProfileDraft {
  return { name: "", slug: "", description: "", websiteUrl: "", social: emptySocial() }
}

export function draftFromOrg(org: AdminOrgDTO): OrgProfileDraft {
  const social = emptySocial()
  for (const p of SOCIAL_PLATFORMS) social[p] = org.socialLinks?.[p] ?? ""
  return {
    name: org.name,
    slug: org.slug,
    description: org.description ?? "",
    websiteUrl: org.websiteUrl ?? "",
    social,
  }
}

/** The social links object the API accepts, or null when every handle is blank. */
export function socialLinksFromDraft(social: Record<SocialPlatform, string>): SocialLinks | null {
  const out: SocialLinks = {}
  let any = false
  for (const p of SOCIAL_PLATFORMS) {
    const v = social[p].trim().replace(/^@+/, "")
    if (v !== "") {
      out[p] = v
      any = true
    }
  }
  return any ? out : null
}

/**
 * Client-side validation mirroring the create/update request schemas, so the operator sees inline
 * errors before a round-trip. Returns an empty object when the draft is acceptable.
 */
export function validateProfileDraft(draft: OrgProfileDraft): OrgProfileErrors {
  const errors: OrgProfileErrors = {}
  const name = draft.name.trim()
  if (name === "") errors.name = "A name is required."
  else if (name.length > MAX_ORG_NAME) errors.name = `At most ${MAX_ORG_NAME} characters.`
  const slug = slugProblem(draft.slug)
  if (slug) errors.slug = slug
  if (draft.description.length > MAX_ORG_DESCRIPTION) {
    errors.description = `At most ${MAX_ORG_DESCRIPTION} characters.`
  }
  const site = draft.websiteUrl.trim()
  if (site !== "" && !HttpsUrlSchema.safeParse(site).success) {
    errors.websiteUrl = "Must be a full https:// address."
  }
  const links = socialLinksFromDraft(draft.social)
  if (links) {
    const parsed = SocialLinksSchema.safeParse(links)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === "string" && (SOCIAL_PLATFORMS as readonly string[]).includes(key)) {
          errors[key as SocialPlatform] =
            key === "whatsapp"
              ? "Digits only, with country code (7–15 digits, no leading 0)."
              : "Letters, digits, dots and underscores only (max 30)."
        }
      }
    }
  }
  return errors
}

export function buildCreateRequest(
  draft: OrgProfileDraft,
  opts: { ownerUserId: string; verifiedKind: OrgVerificationKind | null; reason: string },
): AdminCreateOrgRequest {
  const description = draft.description.trim()
  const websiteUrl = draft.websiteUrl.trim()
  const socialLinks = socialLinksFromDraft(draft.social)
  return {
    name: draft.name.trim(),
    slug: draft.slug.trim().toLowerCase(),
    ...(description !== "" ? { description } : {}),
    ...(websiteUrl !== "" ? { websiteUrl } : {}),
    ...(socialLinks ? { socialLinks } : {}),
    ownerUserId: opts.ownerUserId,
    ...(opts.verifiedKind ? { verifiedKind: opts.verifiedKind } : {}),
    reason: opts.reason.trim(),
  }
}

function sameSocial(a: SocialLinks | null, b: SocialLinks | null | undefined): boolean {
  const left = a ?? {}
  const right = b ?? {}
  return SOCIAL_PLATFORMS.every((p) => (left[p] ?? null) === (right[p] ?? null))
}

/**
 * The PATCH body for an edit: only the fields that differ from the loaded org are sent, a cleared
 * optional field is sent as null. Returns null when nothing changed (the caller skips the request).
 * Both sides are compared trimmed, so an org stored with stray whitespace is not "dirty" on open and
 * an unchanged field is never sent.
 */
export function buildUpdateRequest(
  org: AdminOrgDTO,
  draft: OrgProfileDraft,
  reason: string,
): AdminUpdateOrgRequest | null {
  const body: AdminUpdateOrgRequest = { id: org.id, reason: reason.trim() }
  let changed = false
  const name = draft.name.trim()
  if (name !== org.name.trim()) {
    body.name = name
    changed = true
  }
  const slug = draft.slug.trim().toLowerCase()
  if (slug !== org.slug) {
    body.slug = slug
    changed = true
  }
  const description = draft.description.trim()
  if (description !== (org.description ?? "").trim()) {
    body.description = description === "" ? null : description
    changed = true
  }
  const websiteUrl = draft.websiteUrl.trim()
  if (websiteUrl !== (org.websiteUrl ?? "").trim()) {
    body.websiteUrl = websiteUrl === "" ? null : websiteUrl
    changed = true
  }
  const socialLinks = socialLinksFromDraft(draft.social)
  if (!sameSocial(socialLinks, org.socialLinks)) {
    body.socialLinks = socialLinks
    changed = true
  }
  return changed ? body : null
}

/**
 * Map a failed create/update to inline field errors. A CONFLICT is the slug (the only unique field an
 * operator supplies) — but only when the request actually carried a slug, which an edit that leaves
 * the slug alone does not; a VALIDATION error carries `fields` keyed by request field. Anything else
 * returns an empty object so the caller falls back to the error toast.
 */
export function fieldErrorsFromError(raw: unknown, request?: { slug?: string }): OrgProfileErrors {
  if (!(raw instanceof Error)) return {}
  const err = toAppError(raw)
  if (err.code === ErrorCode.CONFLICT) {
    return request === undefined || request.slug !== undefined
      ? { slug: "This slug is already taken." }
      : {}
  }
  if (err.code === ErrorCode.VALIDATION && err.fields) {
    const out: OrgProfileErrors = {}
    for (const [key, message] of Object.entries(err.fields)) {
      const field = key.replace(/^socialLinks\./, "")
      if (
        field === "name" ||
        field === "slug" ||
        field === "description" ||
        field === "websiteUrl" ||
        field === "ownerUserId" ||
        field === "reason" ||
        (SOCIAL_PLATFORMS as readonly string[]).includes(field)
      ) {
        out[field as keyof OrgProfileErrors] = message
      }
    }
    return out
  }
  return {}
}

/**
 * Drop the server-reported errors for every profile field whose value changed between two drafts:
 * the operator is fixing that field, so the stale server message must not stick to it. Returns the
 * same object when nothing was cleared, so callers can skip a state update.
 */
export function clearChangedFieldErrors(
  errors: OrgProfileErrors,
  prev: OrgProfileDraft,
  next: OrgProfileDraft,
): OrgProfileErrors {
  const changed: OrgProfileField[] = []
  if (prev.name !== next.name) changed.push("name")
  if (prev.slug !== next.slug) changed.push("slug")
  if (prev.description !== next.description) changed.push("description")
  if (prev.websiteUrl !== next.websiteUrl) changed.push("websiteUrl")
  for (const p of SOCIAL_PLATFORMS) if (prev.social[p] !== next.social[p]) changed.push(p)
  const stale = changed.filter((key) => errors[key] !== undefined)
  if (stale.length === 0) return errors
  const out = { ...errors }
  for (const key of stale) delete out[key]
  return out
}

/** Keep only the errors under `keys` — the fields a given form actually renders. */
export function pickFieldErrors(
  errors: OrgProfileErrors,
  keys: readonly (keyof OrgProfileErrors)[],
): OrgProfileErrors {
  const out: OrgProfileErrors = {}
  for (const key of keys) if (errors[key] !== undefined) out[key] = errors[key]
  return out
}

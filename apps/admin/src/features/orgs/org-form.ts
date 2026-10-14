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
import { normalizeSlug, slugProblem } from "@/features/orgs/org-slug"

// Mirror SocialHandleSchema / WhatsAppNumberSchema in @civfix/shared, which export no constants.
const SOCIAL_HANDLE_MAX = 30
const WHATSAPP_DIGITS_MIN = 7
const WHATSAPP_DIGITS_MAX = 15
const LEADING_AT_SIGNS = /^@+/
const SOCIAL_LINKS_FIELD_PREFIX = /^socialLinks\./
const SOCIAL_HANDLE_PROBLEM = `Letters, digits, dots and underscores only (max ${SOCIAL_HANDLE_MAX}).`
const WHATSAPP_PROBLEM = `Digits only, with country code (${WHATSAPP_DIGITS_MIN}–${WHATSAPP_DIGITS_MAX} digits, no leading 0).`

/** Form state: text fields are strings and "" means empty. */
export interface OrgProfileDraft {
  name: string
  slug: string
  description: string
  websiteUrl: string
  social: Record<SocialPlatform, string>
  logoMediaId: string | null
  logoPreviewUrl: string | null
}

const ORG_PROFILE_SCALAR_FIELDS = ["name", "slug", "description", "websiteUrl", "logoMediaId"] as const

type OrgProfileField = (typeof ORG_PROFILE_SCALAR_FIELDS)[number] | SocialPlatform
export type OrgProfileErrors = Partial<Record<OrgProfileField | "ownerUserId" | "reason", string>>

const SERVER_ERROR_FIELDS = [
  ...ORG_PROFILE_SCALAR_FIELDS,
  "ownerUserId",
  "reason",
  ...SOCIAL_PLATFORMS,
] as const

/** The fields the profile editor renders; a server error on anything else (the reason, say) is toasted. */
const PROFILE_EDITOR_FIELDS: readonly (keyof OrgProfileErrors)[] = [
  ...ORG_PROFILE_SCALAR_FIELDS,
  ...SOCIAL_PLATFORMS,
]

export const SOCIAL_PLACEHOLDER: Record<SocialPlatform, string> = {
  facebook: "pagename",
  instagram: "handle",
  tiktok: "handle",
  x: "handle",
  whatsapp: "12135550123",
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return (values as readonly unknown[]).includes(value)
}

function emptySocial(): Record<SocialPlatform, string> {
  return { facebook: "", instagram: "", tiktok: "", x: "", whatsapp: "" }
}

export function emptyProfileDraft(): OrgProfileDraft {
  return {
    name: "",
    slug: "",
    description: "",
    websiteUrl: "",
    social: emptySocial(),
    logoMediaId: null,
    logoPreviewUrl: null,
  }
}

/** The preview url is left out: it only ever accompanies a logoMediaId. */
export function isEmptyProfileDraft(draft: OrgProfileDraft): boolean {
  const empty = emptyProfileDraft()
  return (
    ORG_PROFILE_SCALAR_FIELDS.every((field) => draft[field] === empty[field]) &&
    SOCIAL_PLATFORMS.every((p) => draft.social[p] === "")
  )
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
    logoMediaId: org.logoMediaId ?? null,
    logoPreviewUrl: org.logoUrl ?? null,
  }
}

export function socialLinksFromDraft(social: Record<SocialPlatform, string>): SocialLinks | null {
  const out: SocialLinks = {}
  let any = false
  for (const p of SOCIAL_PLATFORMS) {
    const v = social[p].trim().replace(LEADING_AT_SIGNS, "")
    if (v !== "") {
      out[p] = v
      any = true
    }
  }
  return any ? out : null
}

function socialLinkErrors(links: SocialLinks): OrgProfileErrors {
  const parsed = SocialLinksSchema.safeParse(links)
  if (parsed.success) return {}
  const errors: OrgProfileErrors = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if (!isOneOf(SOCIAL_PLATFORMS, key)) continue
    errors[key] = key === "whatsapp" ? WHATSAPP_PROBLEM : SOCIAL_HANDLE_PROBLEM
  }
  return errors
}

/** Mirrors the create/update request schemas so the operator sees inline errors before a round-trip. */
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
  return links ? { ...errors, ...socialLinkErrors(links) } : errors
}

export function validateCreateDraft(
  draft: OrgProfileDraft,
  owner: { id: string } | null,
  reason: string,
): OrgProfileErrors {
  const errors = validateProfileDraft(draft)
  if (!owner) errors.ownerUserId = "Pick the person who owns this organization."
  if (reason.trim() === "") errors.reason = "A reason is required."
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
    slug: normalizeSlug(draft.slug),
    ...(description !== "" ? { description } : {}),
    ...(websiteUrl !== "" ? { websiteUrl } : {}),
    ...(socialLinks ? { socialLinks } : {}),
    ...(draft.logoMediaId ? { logoMediaId: draft.logoMediaId } : {}),
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
  const slug = normalizeSlug(draft.slug)
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
  if (draft.logoMediaId !== (org.logoMediaId ?? null)) {
    body.logoMediaId = draft.logoMediaId
    changed = true
  }
  return changed ? body : null
}

export function hasProfileChanges(org: AdminOrgDTO, draft: OrgProfileDraft): boolean {
  return buildUpdateRequest(org, draft, "") !== null
}

/**
 * A CONFLICT is the slug (the only unique field an operator supplies), but only when the request
 * actually carried a slug, which an edit that leaves the slug alone does not. A VALIDATION error
 * carries `fields` keyed by request field. Anything else returns an empty object so the caller falls
 * back to the error toast.
 */
export function fieldErrorsFromError(raw: unknown, request?: { slug?: string }): OrgProfileErrors {
  if (!(raw instanceof Error)) return {}
  const err = toAppError(raw)
  if (err.code === ErrorCode.CONFLICT) {
    return request === undefined || request.slug !== undefined
      ? { slug: "This slug is already taken." }
      : {}
  }
  if (err.code !== ErrorCode.VALIDATION || !err.fields) return {}
  const out: OrgProfileErrors = {}
  for (const [key, message] of Object.entries(err.fields)) {
    const field = key.replace(SOCIAL_LINKS_FIELD_PREFIX, "")
    if (isOneOf(SERVER_ERROR_FIELDS, field)) out[field] = message
  }
  return out
}

/**
 * A changed field is one the operator is fixing, so its stale server message must not stick to it.
 * Returns the same object when nothing was cleared, so callers can skip a state update.
 */
export function clearChangedFieldErrors(
  errors: OrgProfileErrors,
  prev: OrgProfileDraft,
  next: OrgProfileDraft,
): OrgProfileErrors {
  const changed: OrgProfileField[] = [
    ...ORG_PROFILE_SCALAR_FIELDS.filter((field) => prev[field] !== next[field]),
    ...SOCIAL_PLATFORMS.filter((p) => prev.social[p] !== next.social[p]),
  ]
  const stale = changed.filter((key) => errors[key] !== undefined)
  if (stale.length === 0) return errors
  const out = { ...errors }
  for (const key of stale) delete out[key]
  return out
}

export function pickFieldErrors(
  errors: OrgProfileErrors,
  keys: readonly (keyof OrgProfileErrors)[],
): OrgProfileErrors {
  const out: OrgProfileErrors = {}
  for (const key of keys) if (errors[key] !== undefined) out[key] = errors[key]
  return out
}

export function updateFieldErrors(raw: unknown, request: AdminUpdateOrgRequest): OrgProfileErrors {
  return pickFieldErrors(fieldErrorsFromError(raw, request), PROFILE_EDITOR_FIELDS)
}

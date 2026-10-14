import { ORG_SLUG_MAX, ORG_SLUG_MIN, OrgSlugSchema } from "@civfix/shared"

const PUBLIC_ORG_HOST = "civfix.org"
const PUBLIC_ORG_ORIGIN = `https://${PUBLIC_ORG_HOST}`
const PUBLIC_ORG_PATH = "/orgs/"

export const PUBLIC_ORG_URL_LABEL = `${PUBLIC_ORG_HOST}${PUBLIC_ORG_PATH}`

export const SLUG_RULES_HINT = `${ORG_SLUG_MIN}–${ORG_SLUG_MAX} lowercase letters, digits and hyphens.`

const COMBINING_MARKS = /\p{M}/gu
const NON_SLUG_RUNS = /[^a-z0-9]+/g
const EDGE_HYPHENS = /^-+|-+$/g
const TRAILING_HYPHENS = /-+$/g

// Checked in order, so the operator sees the most basic problem first.
const SLUG_CHARACTER_RULES: readonly (readonly [RegExp, string])[] = [
  [/[A-Z]/, "Lowercase only."],
  [/[^a-z0-9-]/, "Only letters, digits and hyphens."],
  [/^-|-$/, "Cannot start or end with a hyphen."],
  [/--/, "No consecutive hyphens."],
]

export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase()
}

/**
 * May return a string shorter than ORG_SLUG_MIN (e.g. for "LA"); the caller validates with
 * slugProblem before submitting.
 */
export function deriveSlug(name: string): string {
  // NFKD splits accented letters into base + combining mark; \p{M} drops the marks.
  const folded = name.normalize("NFKD").replace(COMBINING_MARKS, "")
  const kebab = folded
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(NON_SLUG_RUNS, "-")
    .replace(EDGE_HYPHENS, "")
  if (kebab.length <= ORG_SLUG_MAX) return kebab
  return kebab.slice(0, ORG_SLUG_MAX).replace(TRAILING_HYPHENS, "")
}

/**
 * The copy mirrors OrgSlugSchema (3–40 chars, lowercase letters/digits, single hyphens between groups)
 * so the live hint matches what the server would reject.
 */
export function slugProblem(slug: string): string | null {
  const value = slug.trim()
  if (value === "") return "A slug is required."
  if (value.length < ORG_SLUG_MIN) return `At least ${ORG_SLUG_MIN} characters.`
  if (value.length > ORG_SLUG_MAX) return `At most ${ORG_SLUG_MAX} characters.`
  const broken = SLUG_CHARACTER_RULES.find(([pattern]) => pattern.test(value))
  if (broken) return broken[1]
  return OrgSlugSchema.safeParse(value).success ? null : "Not a valid slug."
}

export function publicOrgUrl(slug: string): string {
  return `${PUBLIC_ORG_ORIGIN}${PUBLIC_ORG_PATH}${encodeURIComponent(slug)}`
}

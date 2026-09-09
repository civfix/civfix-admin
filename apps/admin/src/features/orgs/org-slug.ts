import { ORG_SLUG_MAX, ORG_SLUG_MIN, OrgSlugSchema } from "@civfix/shared"

export const PUBLIC_ORG_ORIGIN = "https://civfix.org"

/**
 * Derive a URL slug from an organization name: lowercase, ASCII-folded, non-alphanumerics collapsed
 * into single hyphens, trimmed to ORG_SLUG_MAX without leaving a dangling hyphen. May return a string
 * shorter than ORG_SLUG_MIN (e.g. for "LA"); the caller validates with slugProblem before submitting.
 */
export function deriveSlug(name: string): string {
  // NFKD splits accented letters into base + combining mark; \p{M} drops the marks.
  const folded = name.normalize("NFKD").replace(/\p{M}/gu, "")
  const kebab = folded
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (kebab.length <= ORG_SLUG_MAX) return kebab
  return kebab.slice(0, ORG_SLUG_MAX).replace(/-+$/g, "")
}

/**
 * Human-readable reason a slug is not acceptable, or null when OrgSlugSchema accepts it. The copy
 * mirrors the schema (3–40 chars, lowercase letters/digits, single hyphens between groups) so the
 * live hint matches what the server would reject.
 */
export function slugProblem(slug: string): string | null {
  const value = slug.trim()
  if (value === "") return "A slug is required."
  if (value.length < ORG_SLUG_MIN) return `At least ${ORG_SLUG_MIN} characters.`
  if (value.length > ORG_SLUG_MAX) return `At most ${ORG_SLUG_MAX} characters.`
  if (/[A-Z]/.test(value)) return "Lowercase only."
  if (/[^a-z0-9-]/.test(value)) return "Only letters, digits and hyphens."
  if (/^-|-$/.test(value)) return "Cannot start or end with a hyphen."
  if (/--/.test(value)) return "No consecutive hyphens."
  return OrgSlugSchema.safeParse(value).success ? null : "Not a valid slug."
}

/** The public organization page for a slug (opened in a new tab from the console). */
export function publicOrgUrl(slug: string): string {
  return `${PUBLIC_ORG_ORIGIN}/orgs/${encodeURIComponent(slug)}`
}

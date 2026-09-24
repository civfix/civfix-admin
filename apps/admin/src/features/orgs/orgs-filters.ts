import type { AdminOrgCounts, AdminOrgListQuery } from "@civfix/shared"

/**
 * The organization list chips. The four verification statuses map onto the `verified` facet of
 * adminListOrgs; `suspended` is the orthogonal operator flag (DECISIONS §32). "pending" is the old
 * verification queue: every org with an application awaiting review.
 */
export const ORG_FILTERS = [
  "all",
  "pending",
  "verified",
  "rejected",
  "unverified",
  "suspended",
] as const

export type OrgFilter = (typeof ORG_FILTERS)[number]

export const ORG_FILTER_LABEL: Record<OrgFilter, string> = {
  all: "All",
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
  unverified: "Unverified",
  suspended: "Suspended",
}

export function isOrgFilter(value: string): value is OrgFilter {
  return (ORG_FILTERS as readonly string[]).includes(value)
}

/**
 * Translate a chip + search box into the adminListOrgs query. An unknown chip is treated as "all"
 * rather than forwarded to the server; an empty/whitespace search sends no `q`.
 */
export function orgListParams(filter: string, q?: string): AdminOrgListQuery {
  const search = (q ?? "").trim()
  const params: AdminOrgListQuery = search === "" ? {} : { q: search }
  if (!isOrgFilter(filter) || filter === "all") return params
  if (filter === "suspended") return { ...params, suspended: true }
  return { ...params, verified: filter }
}

export function orgFilterCount(
  counts: AdminOrgCounts | undefined,
  filter: OrgFilter,
): number | undefined {
  if (!counts) return undefined
  switch (filter) {
    case "all":
      return counts.all
    case "pending":
      return counts.pending
    case "verified":
      return counts.verified
    case "suspended":
      return counts.suspended
    default:
      return undefined
  }
}

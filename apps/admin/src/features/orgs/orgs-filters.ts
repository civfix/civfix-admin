import type { OrgVerificationStatus } from "@civfix/shared"

export const ORG_STATUS_FILTERS = [
  "all",
  "pending",
  "verified",
  "rejected",
  "unverified",
] as const

export type OrgStatusFilter = (typeof ORG_STATUS_FILTERS)[number]

function isOrgStatusFilter(value: string): value is OrgStatusFilter {
  return (ORG_STATUS_FILTERS as readonly string[]).includes(value)
}

export function orgStatusFilterParam(filter: string): OrgVerificationStatus | undefined {
  if (!isOrgStatusFilter(filter) || filter === "all") return undefined
  return filter
}

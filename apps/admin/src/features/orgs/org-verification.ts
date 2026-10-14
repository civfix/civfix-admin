import type { AdminOrgDTO, OrgVerificationKind } from "@civfix/shared"

export const ORG_KIND_LABEL: Record<OrgVerificationKind, string> = {
  nonprofit: "Nonprofit",
  government: "Government",
  community: "Community group",
}

// The backend decides only an open (pending) application and answers anything else with a 409, and a
// soft-deleted organization is read-only in this console.
export function canDecideVerification(org: Pick<AdminOrgDTO, "verifiedStatus" | "deletedAt">): boolean {
  return org.verifiedStatus === "pending" && !org.deletedAt
}

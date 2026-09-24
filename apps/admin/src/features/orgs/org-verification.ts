import type { AdminOrgDTO } from "@civfix/shared"

// The backend decides only an open (pending) application and answers anything else with a 409, and a
// soft-deleted organization is read-only in this console.
export function canDecideVerification(org: Pick<AdminOrgDTO, "verifiedStatus" | "deletedAt">): boolean {
  return org.verifiedStatus === "pending" && !org.deletedAt
}

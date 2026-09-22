import {
  GOV_VERIFICATION_CHECK_LABELS,
  type GovCheckStatus,
  type GovClaimStatus,
  type GovMethod,
  type GovVerificationCheck,
} from "@civfix/shared"

/** Pill treatment per claim lifecycle status. */
export const GOV_CLAIM_STATUS_VIEW: Record<GovClaimStatus, { cls: string; label: string }> = {
  pending: { cls: "status-new", label: "Pending" },
  approved: { cls: "status-ok", label: "Approved" },
  rejected: { cls: "status-flag", label: "Rejected" },
}

/** Pill treatment per verification check state. */
export const GOV_CHECK_STATUS_VIEW: Record<GovCheckStatus, { cls: string; label: string }> = {
  verified: { cls: "status-ok", label: "Verified" },
  pending: { cls: "status-new", label: "Pending" },
}

/** How the applicant reached us. */
export const GOV_METHOD_LABEL: Record<GovMethod, string> = {
  email: "Emailed us",
  cold_outreach: "Cold outreach",
}

/** The three verification checks, in the order the detail panel lists them. */
export const GOV_CHECKS: readonly GovVerificationCheck[] = ["linkedin", "directory", "callback"]

export function govCheckLabel(check: GovVerificationCheck): string {
  return GOV_VERIFICATION_CHECK_LABELS[check]
}

/**
 * Why approve / reject are unavailable, or null when the claim can still be decided. The API refuses a
 * decision on a claim that is no longer pending (409), so the buttons say so rather than failing.
 */
export function govClaimDecisionBlockedFor(status: GovClaimStatus): string | null {
  if (status === "approved") return "This claim was already approved."
  if (status === "rejected") return "This claim was already rejected."
  return null
}

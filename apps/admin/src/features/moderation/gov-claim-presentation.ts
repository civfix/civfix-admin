import {
  ErrorCode,
  GOV_VERIFICATION_CHECK_LABELS,
  type GovCheckStatus,
  type GovClaimDTO,
  type GovClaimStatus,
  type GovMethod,
  type GovVerificationCheck,
  type VerifyCheckRequest,
} from "@civfix/shared"

import { errorMessage } from "@/lib/error-messages"

export const GOV_CLAIM_STATUS_VIEW: Record<GovClaimStatus, { cls: string; label: string }> = {
  pending: { cls: "status-new", label: "Pending" },
  approved: { cls: "status-ok", label: "Approved" },
  rejected: { cls: "status-flag", label: "Rejected" },
}

// The fallbacks cover a status newer than this build, which the client passes through.
export function govClaimStatusView(status: GovClaimStatus): { cls: string; label: string } {
  return GOV_CLAIM_STATUS_VIEW[status] ?? GOV_CLAIM_STATUS_VIEW.pending
}

export const GOV_CHECK_STATUS_VIEW: Record<GovCheckStatus, { cls: string; label: string }> = {
  verified: { cls: "status-ok", label: "Verified" },
  pending: { cls: "status-new", label: "Pending" },
}

export const GOV_METHOD_LABEL: Record<GovMethod, string> = {
  email: "Emailed us",
  cold_outreach: "Cold outreach",
}

/** In the order the detail panel lists them. */
export const GOV_CHECKS: readonly GovVerificationCheck[] = ["linkedin", "directory", "callback"]

export function govCheckLabel(check: GovVerificationCheck): string {
  return GOV_VERIFICATION_CHECK_LABELS[check]
}

/**
 * The request that moves one check to `next`. Going back to pending keeps the stored evidence; marking
 * verified records what the operator typed (trimmed, omitted when blank). The stored note rides along
 * either way, because the endpoint stores an omitted field as null.
 */
export function verifyCheckRequest(
  claim: Pick<GovClaimDTO, "id" | "checks">,
  check: GovVerificationCheck,
  next: GovCheckStatus,
  typedEvidence = "",
): VerifyCheckRequest {
  const stored = claim.checks[check]
  const evidence = next === "pending" ? stored.evidence : typedEvidence.trim()
  return {
    id: claim.id,
    check,
    status: next,
    ...(evidence ? { evidence } : {}),
    ...(stored.note ? { note: stored.note } : {}),
  }
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

export function govClaimApproveBlockedFor(claim: GovClaimDTO): string | null {
  const lifecycle = govClaimDecisionBlockedFor(claim.status)
  if (lifecycle !== null) return lifecycle
  if (claim.contactEmail.trim() === "") {
    return "This claim has no contact email, so there is no account to grant government access to."
  }
  return null
}

export function govClaimApproveConfirmBody(claim: GovClaimDTO, checkCount: number): string {
  return [
    `This grants government access to the account for ${claim.contactEmail}, creating a placeholder account first if that address has none yet.`,
    claim.jurisdictionGeoid === null
      ? null
      : `The approved claim is what links that account to jurisdiction ${claim.jurisdictionGeoid}.`,
    "That account's existing sessions are signed out only if its role actually changes.",
    `${claim.verified.length} of ${checkCount} checks verified.`,
    "It is written to the audit log.",
  ]
    .filter((line): line is string => line !== null)
    .join(" ")
}

export function govClaimApproveErrorMessage(error: unknown): string {
  return errorMessage(
    error,
    {
      [ErrorCode.FORBIDDEN]:
        "That contact email belongs to an operator account. Operator accounts are managed through ADMIN_EMAILS and cannot be re-roled here, so the applicant needs a different address.",
    },
    {
      fields: {
        contactEmail: {
          unverified:
            "That address already has an account, but its owner has never proven they control it. They have to sign in with an email code first, then approve again.",
          required:
            "This claim has no contact email, so there is no account to grant government access to.",
        },
      },
      fallback: "Could not approve this claim. Please try again.",
    },
  )
}

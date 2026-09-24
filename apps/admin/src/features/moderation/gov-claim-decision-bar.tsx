"use client"

import type { GovClaimDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { confirmDialog, promptReason } from "@/components/shared/dialog"
import {
  GOV_CHECKS,
  govClaimApproveBlockedMessage,
  govClaimApproveConfirmBody,
  govClaimDecisionBlockedMessage,
} from "@/features/moderation/gov-claim-presentation"
import type { useApproveGovClaim, useRejectGovClaim } from "@/features/moderation/use-gov-claims"

function DecisionBlockedNote({
  decisionBlocked,
  approveBlocked,
}: {
  decisionBlocked: string | null
  approveBlocked: string | null
}) {
  if (decisionBlocked) {
    return (
      <div className="pay-note">
        <Icons.Clock size={13} /> {decisionBlocked} Decisions are final; the applicant applies again
        if something changed.
      </div>
    )
  }
  if (approveBlocked) {
    return (
      <div className="pay-note">
        <Icons.AlertTriangle size={13} /> {approveBlocked}
      </div>
    )
  }
  return null
}

export function GovClaimDecisionBar({
  claim,
  approve,
  reject,
  busy,
  onDecided,
}: {
  claim: GovClaimDTO
  approve: ReturnType<typeof useApproveGovClaim>
  reject: ReturnType<typeof useRejectGovClaim>
  busy: boolean
  onDecided: (id: string) => void
}) {
  const decisionBlocked = govClaimDecisionBlockedMessage(claim.status)
  const approveBlocked = govClaimApproveBlockedMessage(claim)

  const onApprove = async () => {
    if (approveBlocked !== null) return
    const ok = await confirmDialog({
      title: `Approve ${claim.name}?`,
      body: govClaimApproveConfirmBody(claim, GOV_CHECKS.length),
      confirmLabel: "Approve and provision",
    })
    if (!ok) return
    approve.mutate({ request: { id: claim.id }, claim }, { onSuccess: () => onDecided(claim.id) })
  }

  const onReject = async () => {
    const reason = await promptReason({
      title: `Reject ${claim.name}?`,
      body: "The reason is stored on the claim and written to the audit log.",
      placeholder: "The directory listing does not show this person in that department…",
      confirmLabel: "Reject claim",
      danger: true,
    })
    if (reason === null) return
    reject.mutate(
      { request: { id: claim.id, reason }, claim },
      { onSuccess: () => onDecided(claim.id) },
    )
  }

  return (
    <>
      <div className="rep-actions">
        <span className="rep-actions-label">Decision</span>
        <button
          className="btn sm primary"
          disabled={busy || approveBlocked !== null}
          title={approveBlocked ?? "Provisions a government role for the contact email"}
          onClick={() => void onApprove()}
        >
          <Icons.Check size={11} /> Approve
        </button>
        <div className="spacer" />
        <button
          className="btn danger"
          disabled={busy || decisionBlocked !== null}
          title={decisionBlocked ?? "Rejects the claim with a reason"}
          onClick={() => void onReject()}
        >
          <Icons.X size={13} /> Reject
        </button>
      </div>
      <DecisionBlockedNote decisionBlocked={decisionBlocked} approveBlocked={approveBlocked} />
    </>
  )
}

"use client"

import type { GovClaimDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { isNotFound } from "@/lib/api"
import { GovApplicantCard, GovChecksCard } from "@/features/moderation/gov-claim-cards"
import { GovClaimDecisionBar } from "@/features/moderation/gov-claim-decision-bar"
import {
  GOV_CHECKS,
  GOV_METHOD_LABEL,
  govClaimStatusView,
} from "@/features/moderation/gov-claim-presentation"
import {
  useApproveGovClaim,
  useGovClaim,
  useRejectGovClaim,
  useVerifyGovClaimCheck,
} from "@/features/moderation/use-gov-claims"

export function GovClaimRow({
  item,
  selected,
  onSelect,
}: {
  item: GovClaimDTO
  selected: boolean
  onSelect: (id: string) => void
}) {
  const status = govClaimStatusView(item.status)
  return (
    <div
      className={`qrow ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(item.id)}
      onKeyDown={(e) => {
        if (!isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        onSelect(item.id)
      }}
    >
      <span className="prow-ico hue-slate" title={GOV_METHOD_LABEL[item.method]}>
        <Icons.Building size={15} />
      </span>
      <div className="body">
        <div className="top">
          <span className="title">{item.name}</span>
          <span className="ident">{item.org}</span>
        </div>
        <div className="sub">
          <span className="strong">{item.title}</span>
          <span className="sep">·</span>
          <span>
            {item.verified.length} of {GOV_CHECKS.length} checks verified
          </span>
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${status.cls} tight`}>{status.label}</span>
        <span className="age">{item.age}</span>
      </div>
    </div>
  )
}

// Called by the detail pane rather than its cards: one busy flag spans the check toggles and the
// decision buttons, and a decision's per-call onSuccess fires only while this hook stays mounted.
function useGovClaimMutations() {
  const verifyCheck = useVerifyGovClaimCheck()
  const approve = useApproveGovClaim()
  const reject = useRejectGovClaim()
  const busy = verifyCheck.isPending || approve.isPending || reject.isPending
  return { verifyCheck, approve, reject, busy }
}

function GovClaimHead({ claim }: { claim: GovClaimDTO }) {
  const status = govClaimStatusView(claim.status)
  return (
    <div className="rep-head">
      <span className="rep-head-pin">
        <Icons.Building size={20} />
      </span>
      <div className="rep-head-text">
        <div className="crumb">
          Gov provisioning · {GOV_METHOD_LABEL[claim.method]} ·{" "}
          <span className="mono">{claim.contactEmail}</span>
        </div>
        <h2>{claim.name}</h2>
      </div>
      <span className={`pill ${status.cls}`} style={{ marginLeft: "auto" }}>
        {status.label}
      </span>
    </div>
  )
}

export function GovClaimDetail({
  claimId,
  onDecided,
}: {
  claimId: string
  onDecided: (id: string) => void
}) {
  const claimQuery = useGovClaim(claimId)
  const { verifyCheck, approve, reject, busy } = useGovClaimMutations()

  if (claimQuery.isLoading) return <LoadingState label="Loading claim..." />
  if (claimQuery.isError && !isNotFound(claimQuery.error)) {
    return <ErrorState error={claimQuery.error} onRetry={() => claimQuery.refetch()} />
  }
  const claim = claimQuery.data
  if (!claim)
    return (
      <EmptyState
        title="Claim not found"
        sub="This claim may already have been decided."
        icon={<Icons.Building size={20} />}
      />
    )

  return (
    <div className="rep-detail">
      <GovClaimHead claim={claim} />

      <div className="rep-grid">
        <div className="rep-col">
          <GovChecksCard claim={claim} verifyCheck={verifyCheck} busy={busy} />
        </div>

        <div className="rep-col">
          <GovApplicantCard claim={claim} />
        </div>
      </div>

      <GovClaimDecisionBar
        claim={claim}
        approve={approve}
        reject={reject}
        busy={busy}
        onDecided={onDecided}
      />
    </div>
  )
}

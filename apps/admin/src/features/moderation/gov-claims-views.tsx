"use client"

import type { GovClaimDTO, GovVerificationCheck } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog, promptDialog } from "@/components/shared/dialog"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { isNotFound } from "@/lib/api"
import { isHttpsUrl } from "@/lib/external-url"
import { EMPTY_VALUE } from "@/lib/empty-value"
import {
  GOV_CHECKS,
  GOV_CHECK_STATUS_VIEW,
  GOV_CLAIM_STATUS_VIEW,
  GOV_METHOD_LABEL,
  govCheckLabel,
  govClaimApproveBlockedFor,
  govClaimApproveConfirmBody,
  govClaimDecisionBlockedFor,
} from "@/features/moderation/gov-claim-presentation"
import {
  useApproveGovClaim,
  useGovClaim,
  useRejectGovClaim,
  useVerifyGovClaimCheck,
} from "@/features/moderation/use-gov-claims"
import { useNav } from "@/store/ui-store"

export function GovClaimRow({
  item,
  selected,
  onSelect,
}: {
  item: GovClaimDTO
  selected: boolean
  onSelect: (id: string) => void
}) {
  const status = GOV_CLAIM_STATUS_VIEW[item.status] ?? GOV_CLAIM_STATUS_VIEW.pending
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

function CheckRow({
  claim,
  check,
  busy,
  onToggle,
}: {
  claim: GovClaimDTO
  check: GovVerificationCheck
  busy: boolean
  onToggle: (check: GovVerificationCheck, next: "verified" | "pending") => void
}) {
  const state = claim.checks[check]
  const view = GOV_CHECK_STATUS_VIEW[state.status] ?? GOV_CHECK_STATUS_VIEW.pending
  const verified = state.status === "verified"
  const evidence = state.evidence ?? null
  return (
    <div className="ccat-cell">
      <div className="ccat-cell-head">
        <span className="ccat-label">{govCheckLabel(check)}</span>
        <span className={`pill ${view.cls} tight`} style={{ marginLeft: "auto" }}>
          {view.label}
        </span>
      </div>
      {evidence && (
        <div className="sub-caption">
          {isHttpsUrl(evidence) ? (
            <a href={evidence} target="_blank" rel="noreferrer noopener">
              {evidence}
            </a>
          ) : (
            evidence
          )}
        </div>
      )}
      {state.note && <div className="sub-caption">{state.note}</div>}
      <button
        className="btn sm"
        disabled={busy}
        aria-label={`Mark ${govCheckLabel(check)} ${verified ? "pending" : "verified"}`}
        onClick={() => onToggle(check, verified ? "pending" : "verified")}
      >
        {verified ? (
          <>
            <Icons.Clock size={11} /> Mark pending
          </>
        ) : (
          <>
            <Icons.Check size={11} /> Mark verified
          </>
        )}
      </button>
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
  const q = useGovClaim(claimId)
  const verifyCheck = useVerifyGovClaimCheck()
  const approve = useApproveGovClaim()
  const reject = useRejectGovClaim()
  const nav = useNav()

  const busy = verifyCheck.isPending || approve.isPending || reject.isPending

  if (q.isLoading) return <LoadingState label="Loading claim..." />
  if (q.isError && !isNotFound(q.error)) {
    return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  }
  const claim = q.data
  if (!claim)
    return (
      <EmptyState
        title="Claim not found"
        sub="This claim may already have been decided."
        icon={<Icons.Building size={20} />}
      />
    )

  const status = GOV_CLAIM_STATUS_VIEW[claim.status] ?? GOV_CLAIM_STATUS_VIEW.pending
  const decisionBlocked = govClaimDecisionBlockedFor(claim.status)
  const approveBlocked = govClaimApproveBlockedFor(claim)

  const onToggleCheck = async (check: GovVerificationCheck, next: "verified" | "pending") => {
    const stored = claim.checks[check]
    const keepNote = stored.note ? { note: stored.note } : {}
    if (next === "pending") {
      verifyCheck.mutate(
        {
          id: claim.id,
          check,
          status: "pending",
          ...(stored.evidence ? { evidence: stored.evidence } : {}),
          ...keepNote,
        },
      )
      return
    }
    const evidence = await promptDialog({
      title: `Verify ${govCheckLabel(check)}`,
      body: "Record what you checked. The evidence is stored on the claim and written to the audit log.",
      label: "Evidence link or note (optional)",
      defaultValue: stored.evidence ?? "",
      confirmLabel: "Mark verified",
    })
    if (evidence === null) return
    verifyCheck.mutate(
      {
        id: claim.id,
        check,
        status: "verified",
        ...(evidence.trim() ? { evidence: evidence.trim() } : {}),
        ...keepNote,
      },
    )
  }

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
    const reason = await promptDialog({
      title: `Reject ${claim.name}?`,
      body: "The reason is stored on the claim and written to the audit log.",
      label: "Reason (required)",
      placeholder: "The directory listing does not show this person in that department…",
      confirmLabel: "Reject claim",
      required: true,
      danger: true,
    })
    if (reason === null || reason.trim() === "") return
    reject.mutate(
      { request: { id: claim.id, reason: reason.trim() }, claim },
      { onSuccess: () => onDecided(claim.id) },
    )
  }

  return (
    <div className="rep-detail">
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

      <div className="rep-grid">
        <div className="rep-col">
          <div className="sub">
            <div className="sub-head">
              Verification checks
              <span className="rep-confirms" style={{ marginLeft: "auto" }}>
                <Icons.Shield size={12} /> {claim.verified.length} of {GOV_CHECKS.length}
              </span>
            </div>
            <div className="sub-body">
              <div className="ccat-grid one-col">
                {GOV_CHECKS.map((check) => (
                  <CheckRow
                    key={check}
                    claim={claim}
                    check={check}
                    busy={busy}
                    onToggle={(c, next) => void onToggleCheck(c, next)}
                  />
                ))}
              </div>
              <div className="hint" style={{ marginTop: 10 }}>
                Verify the applicant before approving: approval grants a government role on the
                account behind the contact email.
              </div>
            </div>
          </div>
        </div>

        <div className="rep-col">
          <div className="sub">
            <div className="sub-head">Applicant</div>
            <div className="sub-body">
              <div className="user-head">
                <span className="user-av">
                  <Icons.Users size={16} />
                </span>
                <div>
                  <div className="user-name">{claim.name}</div>
                  <div className="user-handle mono">{claim.contactEmail}</div>
                </div>
              </div>
              <div className="user-meta-rows">
                <div className="umr">
                  <span>Title</span>
                  <span>{claim.title}</span>
                </div>
                <div className="umr">
                  <span>Organization</span>
                  <span>{claim.org}</span>
                </div>
                <div className="umr">
                  <span>Reached us via</span>
                  <span>{GOV_METHOD_LABEL[claim.method]}</span>
                </div>
                <div className="umr">
                  <span>Waiting</span>
                  <span>{claim.age}</span>
                </div>
                <div className="umr">
                  <span>Jurisdiction</span>
                  <span className="mono">{claim.jurisdictionGeoid ?? EMPTY_VALUE}</span>
                </div>
              </div>
              {claim.jurisdictionGeoid && (
                <button
                  className="btn sm ghost full"
                  onClick={() => nav("discovery", claim.jurisdictionGeoid)}
                  title="Open this jurisdiction in Jurisdictions"
                >
                  <Icons.Building size={12} /> View jurisdiction →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

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
      {decisionBlocked ? (
        <div className="pay-note">
          <Icons.Clock size={13} /> {decisionBlocked} Decisions are final; the applicant applies again
          if something changed.
        </div>
      ) : approveBlocked ? (
        <div className="pay-note">
          <Icons.AlertTriangle size={13} /> {approveBlocked}
        </div>
      ) : null}
    </div>
  )
}

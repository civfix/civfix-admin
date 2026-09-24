"use client"

import type { GovCheckStatus, GovClaimDTO, GovVerificationCheck } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { promptDialog } from "@/components/shared/dialog"
import { isHttpsUrl } from "@/lib/external-url"
import { EMPTY_VALUE } from "@/lib/empty-value"
import {
  GOV_CHECKS,
  GOV_CHECK_STATUS_VIEW,
  GOV_METHOD_LABEL,
  govCheckLabel,
  verifyCheckRequest,
} from "@/features/moderation/gov-claim-presentation"
import type { useVerifyGovClaimCheck } from "@/features/moderation/use-gov-claims"
import { useNav } from "@/store/ui-store"

type VerifyCheckMutation = ReturnType<typeof useVerifyGovClaimCheck>

function CheckRow({
  claim,
  check,
  busy,
  onToggle,
}: {
  claim: GovClaimDTO
  check: GovVerificationCheck
  busy: boolean
  onToggle: (check: GovVerificationCheck, next: GovCheckStatus) => void
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

export function GovChecksCard({
  claim,
  verifyCheck,
  busy,
}: {
  claim: GovClaimDTO
  verifyCheck: VerifyCheckMutation
  busy: boolean
}) {
  const onToggleCheck = async (check: GovVerificationCheck, next: GovCheckStatus) => {
    if (next === "pending") {
      verifyCheck.mutate(verifyCheckRequest(claim, check, "pending"))
      return
    }
    const evidence = await promptDialog({
      title: `Verify ${govCheckLabel(check)}`,
      body: "Record what you checked. The evidence is stored on the claim and written to the audit log.",
      label: "Evidence link or note (optional)",
      defaultValue: claim.checks[check].evidence ?? "",
      confirmLabel: "Mark verified",
    })
    if (evidence === null) return
    verifyCheck.mutate(verifyCheckRequest(claim, check, "verified", evidence))
  }

  return (
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
          Verify the applicant before approving: approval grants a government role on the account
          behind the contact email.
        </div>
      </div>
    </div>
  )
}

export function GovApplicantCard({ claim }: { claim: GovClaimDTO }) {
  const nav = useNav()
  return (
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
  )
}

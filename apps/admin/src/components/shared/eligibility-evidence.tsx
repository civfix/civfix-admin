"use client"

import type { OrgEligibilityCheckDTO } from "@civfix/shared"

import { formatDateTime } from "@/lib/dates"

export const ELIGIBILITY_SOURCE_LABEL: Record<OrgEligibilityCheckDTO["source"], string> = {
  irs_pub78: "IRS Publication 78",
  irs_eo_bmf: "IRS Exempt Organizations BMF",
  irs_auto_revocation: "IRS Auto-Revocation list",
  ftb_revoked: "CA FTB revoked exempt list",
  ca_ag_mnos: "CA AG May Not Operate or Solicit",
  ofac_sdn: "OFAC Specially Designated Nationals",
  central_org_confirmation: "Central organization confirmation",
}

const CONTRIBUTION_VIEW: Record<
  OrgEligibilityCheckDTO["verdictContribution"],
  { label: string; cls: string }
> = {
  supports: { label: "Supports", cls: "status-ok" },
  disqualifies: { label: "Disqualifies", cls: "status-flag" },
  neutral: { label: "Neutral", cls: "priority-low" },
}

export function EligibilityEvidenceRow({ check }: { check: OrgEligibilityCheckDTO }) {
  const view = CONTRIBUTION_VIEW[check.verdictContribution]
  return (
    <div className="pay-evidence">
      <div className="pay-evidence-top">
        <span className="pay-evidence-src">
          {ELIGIBILITY_SOURCE_LABEL[check.source] ?? check.source}
        </span>
        <span className={`pill ${view.cls} tight`}>{view.label}</span>
        <span className={`pill ${check.matched ? "attention" : "priority-low"} tight`}>
          {check.matched ? "Matched" : "No match"}
        </span>
      </div>
      <div className="pay-evidence-meta">
        <span>
          List revision <b className="mono">{check.sourceRevisionDate}</b>
        </span>
        <span className="sep">·</span>
        <span>
          Checked <b>{formatDateTime(check.checkedAt)}</b>
        </span>
      </div>
      {check.detail && <div className="pay-evidence-detail">{check.detail}</div>}
    </div>
  )
}

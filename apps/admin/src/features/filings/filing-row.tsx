"use client"

import type { AdminFilingDTO } from "@civfix/contract"

import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { formatDateTime } from "@/lib/dates"
import {
  FILING_CHANNEL_LABEL,
  FILING_REASON_LABEL,
  FILING_STATUS_LABEL,
  FILING_STATUS_PILL,
} from "@/features/filings/filing-labels"
import { useNav } from "@/store/ui-store"

// A filing waiting on an operator leads with why; any other leads with the city's request number.
function filingOutcome(filing: AdminFilingDTO): string | null {
  const reason = filing.reason ? FILING_REASON_LABEL[filing.reason] : null
  if (filing.status === "needs_human") return reason
  return filing.caseId ?? reason
}

export function FilingRow({ filing }: { filing: AdminFilingDTO }) {
  const nav = useNav()
  const open = () => nav("reports", filing.reportId)
  const outcome = filingOutcome(filing)
  return (
    <div
      className="qrow"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || !isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        open()
      }}
    >
      <div className="body">
        <div className="top">
          <span className="title">{filing.reportTitle}</span>
          {filing.referenceCode && <span className="ident">{filing.referenceCode}</span>}
        </div>
        <div className="sub">
          <span className="strong">{filing.jurisdictionName ?? "No jurisdiction"}</span>
          <span className="sep">·</span>
          <span>{filing.channel ? FILING_CHANNEL_LABEL[filing.channel] : "No route"}</span>
          {outcome && (
            <>
              <span className="sep">·</span>
              <span>{outcome}</span>
            </>
          )}
        </div>
      </div>
      <div className="trailing">
        <span className={`pill tight ${FILING_STATUS_PILL[filing.status]}`}>
          {FILING_STATUS_LABEL[filing.status]}
        </span>
        <span className="age">{formatDateTime(filing.updatedAt)}</span>
      </div>
    </div>
  )
}

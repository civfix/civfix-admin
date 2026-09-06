"use client"

import * as React from "react"
import { LEGAL_DOCUMENTS } from "@civfix/shared/legal"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { formatDate } from "@/lib/dates"
import { formatMoneyMinor } from "@/lib/money"
import { filingReminders } from "@/features/donations/donations-reporting"
import { useLegalVersions, usePlatformDonationSettings } from "@/features/donations/use-donations"

const AB488_ITEMS: { title: string; detail: string }[] = [
  {
    title: "Form PL-1 registration effective before the first solicitation",
    detail:
      "A charitable fundraising platform must be registered with the California Attorney General before it enables any solicitation. Late registration is retroactively actionable.",
  },
  {
    title: "Written consent on file for every recipient organization",
    detail:
      "Each organization accepts the versioned §318 donation agreement in the Host Console before donations can be enabled. The acceptance record is visible per organization under Organizations → Payments.",
  },
  {
    title: "Good-standing evidence at authorization time",
    detail:
      "IRS Publication 78, EO BMF and Auto-Revocation, CA FTB, the AG registry MNOS list and OFAC are checked and appended as append-only evidence rows. A fresh MNOS hit opens a five-business-day grace period.",
  },
  {
    title: "Five donation-page disclosures and an itemized fee breakdown",
    detail:
      "The public donate page states the recipient, the may-not-receive notice, the remittance timing, the fees and the deductibility, and never claims that 100% reaches the charity.",
  },
  {
    title: "Receipts issued within five business days as the charity's agent",
    detail:
      "Receipts are generated from the IRS legal name, EIN and address held in the eligibility evidence, not from self-asserted verification data.",
  },
  {
    title: "Form PL-2 renewal and Form PL-4 annual report calendared",
    detail:
      "PL-2 renews the registration each January 15; PL-4 reports the prior calendar year each July 15. Export the totals from the PL-4 report tab.",
  },
]

export function ComplianceChecklist() {
  const reminders = React.useMemo(() => filingReminders(), [])
  const settings = usePlatformDonationSettings()
  const legal = useLegalVersions()
  const served = React.useMemo(
    () => new Map((legal.data?.documents ?? []).map((d) => [d.type, d])),
    [legal.data],
  )

  return (
    <div className="don-compliance">
      <div className="sub">
        <div className="sub-head">Platform registration</div>
        <div className="sub-body">
          {settings.isLoading ? (
            <LoadingState label="Reading the platform donation settings..." />
          ) : settings.isError ? (
            <ErrorState
              error={settings.error}
              onRetry={() => settings.refetch()}
              title="Could not read the platform donation settings"
            />
          ) : settings.data ? (
            <>
              <div className="user-meta-rows">
                <div className="umr">
                  <span>CA AG registration number</span>
                  {settings.data.registrationNumber === null ? (
                    <span className="muted">Not configured</span>
                  ) : (
                    <span className="mono">{settings.data.registrationNumber}</span>
                  )}
                </div>
                <div className="umr">
                  <span>Donations</span>
                  <span
                    className={`pill tight ${settings.data.paymentsEnabled ? "status-ok" : "priority-low"}`}
                  >
                    {settings.data.paymentsEnabled ? "Enabled" : "Disabled platform-wide"}
                  </span>
                </div>
                <div className="umr">
                  <span>civfix platform fee</span>
                  <span className="mono">
                    {(settings.data.platformFeeBps / 100).toFixed(2)}%
                  </span>
                </div>
                <div className="umr">
                  <span>Accepted amount</span>
                  <span className="mono">
                    {formatMoneyMinor(settings.data.minAmountMinor, settings.data.currency)} –{" "}
                    {formatMoneyMinor(settings.data.maxAmountMinor, settings.data.currency)}
                  </span>
                </div>
                <div className="umr">
                  <span>Eligibility grace</span>
                  <span className="mono">{settings.data.eligibilityStaleGraceHours}h</span>
                </div>
              </div>
              {settings.data.registrationNumber === null && (
                <div className="pay-note tone-alert">
                  <Icons.AlertTriangle size={13} /> No registration number is configured. AB 488
                  requires an effective Form PL-1 registration before the platform enables any
                  solicitation.
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="sub">
        <div className="sub-head">Filing calendar</div>
        <div className="sub-body">
          <div className="don-filings">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className={`don-filing ${reminder.daysRemaining <= 45 ? "tone-warn" : ""}`}
              >
                <span className="don-filing-label">{reminder.label}</span>
                <span className="don-filing-date mono">{reminder.dueOn}</span>
                <span className="don-filing-sub">
                  {reminder.covers} · in {reminder.daysRemaining} days
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sub">
        <div className="sub-head">Operator checklist (reference)</div>
        <div className="sub-body">
          <div className="bcast-note">
            <Icons.AlertTriangle size={12} /> These six obligations are a reading aid, not a
            verified state: civfix does not tick them off automatically. Each is evidenced on the
            surface named in its description.
          </div>
          <div className="don-checklist">
            {AB488_ITEMS.map((item) => (
              <div key={item.title} className="don-check">
                <span className="don-check-ico">
                  <Icons.Shield size={13} />
                </span>
                <div className="don-check-text">
                  <div className="don-check-title">{item.title}</div>
                  <div className="don-check-detail">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sub">
        <div className="sub-head">Legal document versions</div>
        <div className="sub-body">
          {legal.isLoading ? (
            <LoadingState label="Checking what the API serves..." />
          ) : legal.isError ? (
            <ErrorState
              error={legal.error}
              onRetry={() => legal.refetch()}
              title="Could not read the served legal versions"
            />
          ) : null}
          <div className="don-legal">
            {LEGAL_DOCUMENTS.map((doc) => {
              const live = served.get(doc.type)
              const drift = live !== undefined && live.version !== doc.version
              return (
                <div key={doc.type} className={`don-legal-row ${drift ? "tone-alert" : ""}`}>
                  <span className="don-legal-type">{doc.type.replace(/_/g, " ")}</span>
                  <span className="mono">{doc.version}</span>
                  <span>{formatDate(doc.effectiveAt)}</span>
                  <span className="mono muted">
                    {live === undefined ? "not verified" : drift ? `API: ${live.version}` : "in sync"}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="bcast-note">
            <Icons.Lock size={12} /> Versions come from the @civfix/shared contract, which is the
            single source of truth every consent record is validated against.
          </div>
        </div>
      </div>
    </div>
  )
}

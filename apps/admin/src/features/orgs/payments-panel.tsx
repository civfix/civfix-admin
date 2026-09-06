"use client"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { EmptyState } from "@/components/shared/page-primitives"
import { EligibilityEvidenceRow } from "@/components/shared/eligibility-evidence"
import { promptDialog } from "@/components/shared/dialog"
import { formatDate, formatDateTime } from "@/lib/dates"
import { formatMoneyMinor } from "@/lib/money"
import {
  capabilityRows,
  disabledReasonLabel,
  donateStateView,
  eligibilityVerdictView,
  maskAccountId,
  paymentsStateView,
  requirementGroups,
} from "@/lib/payments-view"
import { useAdminOrgPayments, useSetOrgDonationsEnabled } from "@/features/orgs/use-orgs"
import { useToast } from "@/store/ui-store"

export function PaymentsPanel({ orgId }: { orgId: string }) {
  const q = useAdminOrgPayments(orgId)
  const setEnabled = useSetOrgDonationsEnabled()
  const toast = useToast()

  if (q.isLoading) return <LoadingState label="Loading payments..." />
  if (q.isError) {
    return (
      <ErrorState
        error={q.error}
        onRetry={() => q.refetch()}
        title="Could not load payments for this organization"
      />
    )
  }
  const data = q.data
  if (!data) return null

  const status = data.status
  const stateView = paymentsStateView(
    status.state,
    status.donationsEnabled,
    status.donationsDisabledReason,
  )
  const donate = donateStateView(status.donateState)
  const verdict = eligibilityVerdictView(status.eligibility.verdict)
  const disabled = disabledReasonLabel(status.donationsDisabledReason)
  const groups = requirementGroups(status)
  const capabilities = capabilityRows(status)

  const onToggleDonations = async () => {
    const enabling = !status.donationsEnabled
    const reason = await promptDialog({
      title: enabling ? "Re-enable donations" : "Disable donations",
      body: enabling
        ? `Donations for ${data.orgName} become collectable again as soon as the connected account allows charges. The reason is written to the audit log.`
        : `${data.orgName} stops collecting donations immediately. Existing donations, receipts and refunds are untouched. The reason is written to the audit log.`,
      label: "Reason (required)",
      placeholder: enabling
        ? "Eligibility restored after AG registry update…"
        : "Listed on the CA AG May Not Operate or Solicit list…",
      confirmLabel: enabling ? "Re-enable donations" : "Disable donations",
      required: true,
      danger: !enabling,
    })
    if (reason === null || reason.trim() === "") return
    setEnabled.mutate(
      { id: orgId, enabled: enabling, reason: reason.trim() },
      {
        onSuccess: () =>
          toast(enabling ? "Donations re-enabled" : `Donations disabled · ${data.orgName}`),
      },
    )
  }

  return (
    <div className="pay-panel">
      <div className="sub">
        <div className="sub-head">
          Connected account
          <span className={`pill ${stateView.cls} tight`} style={{ marginLeft: "auto" }}>
            {stateView.label}
          </span>
          <span className={`pill ${donate.cls} tight`}>{donate.label}</span>
        </div>
        <div className="sub-body">
          <div className="user-meta-rows">
            <div className="umr">
              <span>Stripe account</span>
              <span className="mono">{maskAccountId(status.stripeAccountId)}</span>
            </div>
            <div className="umr">
              <span>Mode</span>
              <span>{status.livemode ? "Live" : "Test"}</span>
            </div>
            <div className="umr">
              <span>Details submitted</span>
              <span>{status.detailsSubmitted ? "Yes" : "No"}</span>
            </div>
            <div className="umr">
              <span>Charges enabled</span>
              <span>{status.chargesEnabled ? "Yes" : "No"}</span>
            </div>
            <div className="umr">
              <span>Payouts enabled</span>
              <span>{status.payoutsEnabled ? "Yes" : "No"}</span>
            </div>
            <div className="umr">
              <span>Last synced</span>
              <span>{formatDateTime(status.lastSyncedAt)}</span>
            </div>
          </div>
          {status.disabledReason && (
            <div className="pay-note tone-alert">
              <Icons.AlertTriangle size={13} /> Stripe disabled reason:{" "}
              <b className="mono">{status.disabledReason}</b>
            </div>
          )}
          {disabled && (
            <div className="pay-note">
              <Icons.Lock size={13} /> {disabled}
              {data.disabledReasonText ? ` — “${data.disabledReasonText}”` : ""}
              {data.disabledBy ? ` (${data.disabledBy.name})` : ""}
            </div>
          )}
        </div>
      </div>

      <div className="sub">
        <div className="sub-head">Capabilities and requirements</div>
        <div className="sub-body">
          {capabilities.length === 0 ? (
            <div className="pay-note">No capabilities reported by Stripe yet.</div>
          ) : (
            <div className="pay-caps">
              {capabilities.map((cap) => (
                <span
                  key={cap.name}
                  className={`pill tight ${cap.state === "active" ? "status-ok" : cap.state === "pending" ? "status-progress" : "priority-low"}`}
                >
                  {cap.name} · {cap.state}
                </span>
              ))}
            </div>
          )}
          {groups.length === 0 ? (
            <div className="pay-note tone-ok">
              <Icons.Check size={13} /> No outstanding Stripe requirements.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="pay-reqs">
                <span className="pay-reqs-label">{group.label}</span>
                <ul className="pay-reqs-list">
                  {group.items.map((item) => (
                    <li key={item} className="mono">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          {status.currentDeadline && (
            <div className="pay-note tone-warn">
              <Icons.Clock size={13} /> Stripe deadline {formatDate(status.currentDeadline)}
            </div>
          )}
          {status.walletsAvailable.length > 0 && (
            <div className="pay-note">
              <Icons.Globe size={13} /> Wallets: {status.walletsAvailable.join(", ")}
            </div>
          )}
        </div>
      </div>

      <div className="sub">
        <div className="sub-head">
          Eligibility
          <span className={`pill ${verdict.cls} tight`} style={{ marginLeft: "auto" }}>
            {verdict.label}
          </span>
        </div>
        <div className="sub-body">
          <div className="user-meta-rows">
            <div className="umr">
              <span>IRS legal name</span>
              <span>{status.eligibility.irsLegalName ?? "—"}</span>
            </div>
            <div className="umr">
              <span>EIN</span>
              <span className="mono">
                {status.eligibility.einLast4 ? `••–•••${status.eligibility.einLast4}` : "—"}
              </span>
            </div>
            <div className="umr">
              <span>Deductibility code</span>
              <span className="mono">{status.eligibility.deductibilityCode ?? "—"}</span>
            </div>
            <div className="umr">
              <span>Foundation code</span>
              <span className="mono">{status.eligibility.foundationCode ?? "—"}</span>
            </div>
            <div className="umr">
              <span>Evaluated</span>
              <span>{formatDateTime(status.eligibility.evaluatedAt)}</span>
            </div>
            <div className="umr">
              <span>Next check</span>
              <span>{formatDateTime(status.eligibility.nextCheckAt)}</span>
            </div>
            {status.eligibility.graceExpiresAt && (
              <div className="umr">
                <span>Grace expires</span>
                <span>{formatDateTime(status.eligibility.graceExpiresAt)}</span>
              </div>
            )}
          </div>
          {status.eligibility.reasons.length > 0 && (
            <div className="pay-reqs">
              <span className="pay-reqs-label">Reasons</span>
              <ul className="pay-reqs-list">
                {status.eligibility.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          {status.eligibility.checks.length === 0 ? (
            <EmptyState
              title="No evidence rows yet"
              sub="Eligibility evidence is appended when the IRS, FTB, AG and OFAC imports run."
              icon={<Icons.Shield size={20} />}
            />
          ) : (
            <div className="pay-evidence-list">
              {status.eligibility.checks.map((check, index) => (
                <EligibilityEvidenceRow key={`${check.source}-${check.checkedAt}-${index}`} check={check} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sub">
        <div className="sub-head">Section 318 agreement</div>
        <div className="sub-body">
          <div className="user-meta-rows">
            <div className="umr">
              <span>Accepted version</span>
              <span className="mono">{status.agreement.version ?? "—"}</span>
            </div>
            <div className="umr">
              <span>Required version</span>
              <span className="mono">{status.agreement.requiredVersion ?? "—"}</span>
            </div>
            <div className="umr">
              <span>Accepted</span>
              <span>{formatDateTime(status.agreement.acceptedAt)}</span>
            </div>
            <div className="umr">
              <span>Accepted by</span>
              <span>{status.agreement.acceptedByName ?? "—"}</span>
            </div>
          </div>
          <div className={`pay-note ${status.agreement.current ? "tone-ok" : "tone-alert"}`}>
            {status.agreement.current ? (
              <>
                <Icons.Check size={13} /> The organization has accepted the current agreement.
              </>
            ) : (
              <>
                <Icons.AlertTriangle size={13} /> The organization has not accepted the current
                agreement version.
              </>
            )}
          </div>
          {data.agreementHistory.length > 0 && (
            <div className="pay-history">
              {data.agreementHistory.map((entry) => (
                <div key={`${entry.version}-${entry.acceptedAt}`} className="pay-history-row">
                  <span className="mono">{entry.version}</span>
                  <span>{formatDateTime(entry.acceptedAt)}</span>
                  <span>{entry.acceptedByName ?? "—"}</span>
                  <span className="muted">{entry.surface ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="sub">
        <div className="sub-head">Lifetime donations</div>
        <div className="sub-body">
          <div className="user-meta-rows">
            <div className="umr">
              <span>Gross received</span>
              <span className="mono">{formatMoneyMinor(data.lifetimeGrossMinor)}</span>
            </div>
            <div className="umr">
              <span>Donations</span>
              <span className="mono">{data.lifetimeDonationCount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rep-actions">
        <span className="rep-actions-label">Donations</span>
        <span className={`pill ${status.donationsEnabled ? "status-ok" : "status-flag"} tight`}>
          {status.donationsEnabled ? "Enabled" : "Disabled"}
        </span>
        <div className="spacer" />
        <button
          type="button"
          className={`btn ${status.donationsEnabled ? "danger" : "primary"}`}
          disabled={setEnabled.isPending}
          onClick={() => void onToggleDonations()}
        >
          <Icons.Lock size={13} />{" "}
          {status.donationsEnabled ? "Disable donations" : "Re-enable donations"}
        </button>
      </div>
    </div>
  )
}

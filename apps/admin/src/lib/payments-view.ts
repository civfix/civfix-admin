import type {
  DonateState,
  EligibilityVerdict,
  OrgPaymentsState,
  OrgPaymentsStatusDTO,
} from "@civfix/shared"

export interface PillView {
  label: string
  cls: string
}

const PAYMENTS_STATE_VIEW: Record<OrgPaymentsState, PillView> = {
  not_started: { label: "Not connected", cls: "priority-low" },
  onboarding: { label: "Onboarding", cls: "status-progress" },
  ready: { label: "Ready", cls: "status-ok" },
  at_risk: { label: "At risk", cls: "attention" },
  blocked: { label: "Blocked", cls: "status-flag" },
}

export type DonationsDisabledReason = OrgPaymentsStatusDTO["donationsDisabledReason"] | string

export function paymentsStateView(
  state: OrgPaymentsState,
  donationsEnabled: boolean,
  disabledReason: DonationsDisabledReason,
): PillView {
  if (!donationsEnabled && disabledReason === "operator") {
    return { label: "Disabled by operator", cls: "status-flag" }
  }
  return PAYMENTS_STATE_VIEW[state]
}

const DONATE_STATE_VIEW: Record<DonateState, PillView> = {
  READY: { label: "Donations live", cls: "status-ok" },
  AT_RISK: { label: "At risk", cls: "attention" },
  BLOCKED: { label: "Blocked", cls: "status-flag" },
  OFF: { label: "Off", cls: "priority-low" },
}

export function donateStateView(state: DonateState): PillView {
  return DONATE_STATE_VIEW[state]
}

const ELIGIBILITY_VERDICT_VIEW: Record<EligibilityVerdict, PillView> = {
  unknown: { label: "Unknown", cls: "priority-low" },
  eligible: { label: "Eligible", cls: "status-ok" },
  grace: { label: "Grace period", cls: "attention" },
  ineligible: { label: "Ineligible", cls: "status-flag" },
  review_required: { label: "Review required", cls: "status-progress" },
}

export function eligibilityVerdictView(verdict: EligibilityVerdict): PillView {
  return ELIGIBILITY_VERDICT_VIEW[verdict]
}

const DISABLED_REASON_LABEL: Record<string, string> = {
  org: "Turned off by the organization",
  operator: "Turned off by a civfix operator",
  eligibility: "Automatically disabled: eligibility lost",
  stripe_blocked: "Automatically disabled: Stripe blocked charges",
  deauthorized: "Automatically disabled: connected account deauthorized",
}

export function disabledReasonLabel(reason: DonationsDisabledReason): string | null {
  if (reason === null || reason === undefined) return null
  return DISABLED_REASON_LABEL[reason] ?? reason
}

export function maskAccountId(accountId: string | null | undefined): string {
  if (accountId === null || accountId === undefined) return "—"
  const trimmed = accountId.trim()
  if (trimmed === "") return "—"
  const underscore = trimmed.indexOf("_")
  const prefix = underscore > 0 ? trimmed.slice(0, underscore + 1) : ""
  const rest = trimmed.slice(prefix.length)
  if (rest.length <= 4) return `${prefix}••••`
  return `${prefix}••••${rest.slice(-4)}`
}

export interface RequirementGroup {
  label: string
  items: string[]
}

export function requirementGroups(status: OrgPaymentsStatusDTO): RequirementGroup[] {
  return [
    { label: "Past due", items: status.pastDue },
    { label: "Currently due", items: status.currentlyDue },
    { label: "Pending verification", items: status.pendingVerification },
    { label: "Future requirements", items: status.futureCurrentlyDue },
  ].filter((group) => group.items.length > 0)
}

export function capabilityRows(status: OrgPaymentsStatusDTO): { name: string; state: string }[] {
  return Object.entries(status.capabilities)
    .map(([name, state]) => ({ name, state }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

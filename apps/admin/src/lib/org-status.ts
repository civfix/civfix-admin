import type { OrgVerificationStatus } from "@civfix/shared"

/** Pill treatment per org verification status, shared by the org list, profile and verification. */
export const ORG_STATUS_VIEW: Record<OrgVerificationStatus, { label: string; cls: string }> = {
  unverified: { label: "Unverified", cls: "priority-low" },
  pending: { label: "Pending review", cls: "status-progress" },
  verified: { label: "Verified", cls: "status-ok" },
  rejected: { label: "Rejected", cls: "status-flag" },
}

// The shared client passes enum values it does not know through, so a status added server-side
// must render as its raw value instead of crashing the org views.
export function orgStatusView(status: OrgVerificationStatus): { label: string; cls: string } {
  return Object.hasOwn(ORG_STATUS_VIEW, status)
    ? ORG_STATUS_VIEW[status]
    : { label: status, cls: "priority-low" }
}

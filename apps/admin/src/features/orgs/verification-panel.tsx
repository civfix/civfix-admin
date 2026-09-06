"use client"

import type { OrgVerificationKind, OrgVerificationStatus } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog, promptDialog } from "@/components/shared/dialog"
import { formatDate, formatDateTime } from "@/lib/dates"
import { isHttpsUrl } from "@/lib/external-url"
import { EvidenceList } from "@/features/orgs/evidence-list"
import { useAdminOrg, useDecideOrgVerification } from "@/features/orgs/use-orgs"
import { useNav, useToast } from "@/store/ui-store"

export const ORG_STATUS_VIEW: Record<OrgVerificationStatus, { label: string; cls: string }> = {
  unverified: { label: "Unverified", cls: "priority-low" },
  pending: { label: "Pending review", cls: "status-progress" },
  verified: { label: "Verified", cls: "status-ok" },
  rejected: { label: "Rejected", cls: "status-flag" },
}

export const ORG_KIND_LABEL: Record<OrgVerificationKind, string> = {
  nonprofit: "Nonprofit",
  government: "Government",
  community: "Community group",
}

const APPROVE_KINDS: OrgVerificationKind[] = ["nonprofit", "government", "community"]

export function VerificationPanel({ orgId }: { orgId: string }) {
  const q = useAdminOrg(orgId)
  const decide = useDecideOrgVerification()
  const toast = useToast()
  const nav = useNav()

  if (q.isLoading) return <LoadingState label="Loading organization..." />
  if (q.isError) {
    return (
      <ErrorState
        error={q.error}
        onRetry={() => q.refetch()}
        title="Could not load this organization"
      />
    )
  }
  const org = q.data
  if (!org) return null

  const verification = org.verification ?? null
  const statusView = ORG_STATUS_VIEW[org.verifiedStatus]
  const documentIds = verification?.documentMediaIds ?? []
  const pending = org.verifiedStatus === "pending"

  const onApprove = async (kind: OrgVerificationKind) => {
    const ok = await confirmDialog({
      title: `Verify ${org.name} as ${ORG_KIND_LABEL[kind].toLowerCase()}?`,
      body: "A verified organization can host events under its own name and, once eligible, collect donations. The decision is written to the audit log.",
      confirmLabel: "Verify organization",
    })
    if (!ok) return
    decide.mutate(
      { id: org.id, decision: "verified", kind },
      { onSuccess: () => toast(`${org.name} verified · ${ORG_KIND_LABEL[kind]}`) },
    )
  }

  const onReject = async () => {
    const reason = await promptDialog({
      title: `Reject ${org.name}?`,
      body: "The applicant sees the reason. It is written to the audit log.",
      label: "Reason (required)",
      placeholder: "The uploaded determination letter does not match the submitted EIN…",
      confirmLabel: "Reject verification",
      required: true,
      danger: true,
    })
    if (reason === null || reason.trim() === "") return
    decide.mutate(
      { id: org.id, decision: "rejected", reason: reason.trim() },
      { onSuccess: () => toast(`${org.name} rejected`) },
    )
  }

  return (
    <div className="org-panel">
      <div className="sub">
        <div className="sub-head">
          Profile
          <span className={`pill ${statusView.cls} tight`} style={{ marginLeft: "auto" }}>
            {statusView.label}
          </span>
        </div>
        <div className="sub-body">
          <div className="user-head">
            {org.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="user-av" src={org.logoUrl} alt="" />
            ) : (
              <span className="user-av">
                <Icons.Building size={16} />
              </span>
            )}
            <div>
              <div className="user-name">{org.name}</div>
              <div className="user-handle mono">/{org.slug}</div>
            </div>
          </div>
          {org.description && <p className="rep-desc">{org.description}</p>}
          <div className="user-meta-rows">
            <div className="umr">
              <span>Kind</span>
              <span>{org.verifiedKind ? ORG_KIND_LABEL[org.verifiedKind] : "—"}</span>
            </div>
            <div className="umr">
              <span>Website</span>
              <span>
                {isHttpsUrl(org.websiteUrl) ? (
                  <a href={org.websiteUrl} target="_blank" rel="noreferrer noopener">
                    {org.websiteUrl}
                  </a>
                ) : org.websiteUrl ? (
                  org.websiteUrl
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="umr">
              <span>Members</span>
              <span className="mono">{org.memberCount.toLocaleString()}</span>
            </div>
            <div className="umr">
              <span>Events</span>
              <span className="mono">{org.eventCount.toLocaleString()}</span>
            </div>
            <div className="umr">
              <span>Created</span>
              <span>{formatDate(org.createdAt)}</span>
            </div>
            <div className="umr">
              <span>Verified</span>
              <span>{formatDateTime(org.verifiedAt)}</span>
            </div>
            {org.deletedAt && (
              <div className="umr">
                <span>Deleted</span>
                <span>{formatDateTime(org.deletedAt)}</span>
              </div>
            )}
          </div>
          {org.owner && (
            <button className="btn sm ghost full" onClick={() => nav("users", org.owner!.id)}>
              Owner · {org.owner.name} →
            </button>
          )}
        </div>
      </div>

      <div className="sub">
        <div className="sub-head">
          Application
          {verification?.einLast4 && (
            <span className="rep-confirms mono" style={{ marginLeft: "auto" }}>
              EIN ••–•••{verification.einLast4}
            </span>
          )}
        </div>
        <div className="sub-body">
          {verification === null ? (
            <div className="org-evidence-note">
              This organization has never applied for verification.
            </div>
          ) : (
            <>
              <div className="user-meta-rows">
                <div className="umr">
                  <span>Requested kind</span>
                  <span>{verification.kind ? ORG_KIND_LABEL[verification.kind] : "—"}</span>
                </div>
                <div className="umr">
                  <span>Submitted</span>
                  <span>{formatDateTime(verification.submittedAt)}</span>
                </div>
                <div className="umr">
                  <span>Submitted by</span>
                  <span>{verification.submittedBy?.name ?? "—"}</span>
                </div>
                <div className="umr">
                  <span>Reviewed</span>
                  <span>{formatDateTime(verification.reviewedAt)}</span>
                </div>
                <div className="umr">
                  <span>Reviewed by</span>
                  <span>{verification.reviewedBy?.name ?? "—"}</span>
                </div>
              </div>
              {verification.note && <p className="rep-desc">{verification.note}</p>}
              {verification.rejectionReason && (
                <div className="pay-note tone-alert">
                  <Icons.AlertTriangle size={13} /> Rejected: {verification.rejectionReason}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="sub">
        <div className="sub-head">
          Evidence
          <span className="rep-confirms" style={{ marginLeft: "auto" }}>
            <Icons.FileText size={12} /> {documentIds.length}
          </span>
        </div>
        <div className="sub-body">
          <EvidenceList mediaIds={documentIds} />
        </div>
      </div>

      <div className="rep-actions">
        <span className="rep-actions-label">Decision</span>
        {APPROVE_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={`btn sm ${org.verifiedKind === kind && org.verifiedStatus === "verified" ? "primary" : ""}`}
            disabled={decide.isPending}
            onClick={() => void onApprove(kind)}
          >
            {org.verifiedKind === kind && org.verifiedStatus === "verified" && (
              <Icons.Check size={11} />
            )}
            Verify as {ORG_KIND_LABEL[kind].toLowerCase()}
          </button>
        ))}
        <div className="spacer" />
        <button
          type="button"
          className="btn danger"
          disabled={decide.isPending}
          onClick={() => void onReject()}
        >
          <Icons.X size={13} /> Reject
        </button>
      </div>
      {!pending && org.verifiedStatus !== "unverified" && (
        <div className="pay-note">
          <Icons.Clock size={13} /> This application was already decided. Deciding again overwrites
          the previous outcome and is audited.
        </div>
      )}
    </div>
  )
}

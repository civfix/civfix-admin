"use client"

import {
  OrgVerificationKindSchema,
  type AdminOrgDTO,
  type OrgVerificationKind,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog, promptDialog } from "@/components/shared/dialog"
import { formatDate, formatDateTime } from "@/lib/dates"
import { EMPTY_VALUE } from "@/lib/empty-value"
import { EvidenceList } from "@/features/orgs/evidence-list"
import {
  DeletedFact,
  Fact,
  OrgStatusSubHead,
  UrlFact,
  kindLabel,
} from "@/features/orgs/org-facts"
import { ORG_KIND_LABEL, canDecideVerification } from "@/features/orgs/org-verification"
import { useOrg, useDecideOrgVerification } from "@/features/orgs/use-orgs"
import { useNav } from "@/store/ui-store"

type OrgVerification = NonNullable<AdminOrgDTO["verification"]>

export function VerificationPanel({ orgId }: { orgId: string }) {
  const q = useOrg(orgId)

  if (q.isLoading) return <LoadingState label="Loading organization..." />
  if (q.isError && !q.data) {
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

  return (
    <div className="org-panel">
      <OrgSummary org={org} />
      <ApplicationSummary verification={verification} />
      {verification !== null && <EvidenceSection verification={verification} />}
      <DecisionSection org={org} />
    </div>
  )
}

function OrgSummary({ org }: { org: AdminOrgDTO }) {
  const nav = useNav()
  const owner = org.owner
  return (
    <div className="sub">
      <OrgStatusSubHead title="Profile" org={org} />
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
          <Fact label="Kind">{kindLabel(org.verifiedKind)}</Fact>
          <Fact label="Website">
            <UrlFact url={org.websiteUrl} />
          </Fact>
          <Fact label="Members" mono>
            {org.memberCount.toLocaleString()}
          </Fact>
          <Fact label="Events" mono>
            {org.eventCount.toLocaleString()}
          </Fact>
          <Fact label="Created">{formatDate(org.createdAt)}</Fact>
          <Fact label="Verified">{formatDateTime(org.verifiedAt)}</Fact>
          <DeletedFact deletedAt={org.deletedAt} />
        </div>
        {owner && (
          <button type="button" className="btn sm ghost full" onClick={() => nav("users", owner.id)}>
            Owner · {owner.name} →
          </button>
        )}
      </div>
    </div>
  )
}

function ApplicationSummary({ verification }: { verification: OrgVerification | null }) {
  return (
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
              <Fact label="Requested kind">{kindLabel(verification.kind)}</Fact>
              <Fact label="Submitted">{formatDateTime(verification.submittedAt)}</Fact>
              <Fact label="Submitted by">{verification.submittedBy?.name ?? EMPTY_VALUE}</Fact>
              <Fact label="Reviewed">{formatDateTime(verification.reviewedAt)}</Fact>
              <Fact label="Reviewed by">{verification.reviewedBy?.name ?? EMPTY_VALUE}</Fact>
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
  )
}

function EvidenceSection({ verification }: { verification: OrgVerification }) {
  const documentIds = verification.documentMediaIds ?? []
  return (
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
  )
}

function DecisionSection({ org }: { org: AdminOrgDTO }) {
  const decide = useDecideOrgVerification()

  const onApprove = async (kind: OrgVerificationKind) => {
    const ok = await confirmDialog({
      title: `Verify ${org.name} as ${ORG_KIND_LABEL[kind].toLowerCase()}?`,
      body: "A verified organization can host events under its own name and appear as a verified host across civfix. The decision is written to the audit log.",
      confirmLabel: "Verify organization",
    })
    if (!ok) return
    decide.mutate({ id: org.id, decision: "verified", kind })
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
    decide.mutate({ id: org.id, decision: "rejected", reason: reason.trim() })
  }

  if (!canDecideVerification(org)) {
    return (
      <div className="pay-note">
        <Icons.Clock size={13} />{" "}
        {org.deletedAt
          ? "This organization was deleted, so its application can no longer be decided."
          : "No application is awaiting a decision."}
      </div>
    )
  }
  return (
    <div className="rep-actions">
      <span className="rep-actions-label">Decision</span>
      {OrgVerificationKindSchema.options.map((kind) => (
        <button
          key={kind}
          type="button"
          className="btn sm"
          disabled={decide.isPending}
          onClick={() => void onApprove(kind)}
        >
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
  )
}

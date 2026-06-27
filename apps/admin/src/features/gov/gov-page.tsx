"use client"

import * as React from "react"
import {
  GOV_VERIFICATION_CHECK_LABELS,
  type GovClaimDTO,
  type GovClaimStatus,
  type GovMethod,
  type GovVerificationCheck,
} from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog, promptDialog } from "@/components/shared/dialog"
import { useDebounced } from "@/hooks/use-debounced"
import {
  useApproveGovClaim,
  useGovClaim,
  useGovClaimList,
  useRejectGovClaim,
  useVerifyGovCheck,
} from "@/features/gov/use-gov"
import { useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"


type FilterValue = "all" | GovClaimStatus

const STATUS_VIEW: Record<GovClaimStatus, { cls: string; label: string; icon: IconComponent }> = {
  pending: { cls: "attention", label: "Pending", icon: Icons.Clock },
  approved: { cls: "status-ok", label: "Approved", icon: Icons.Check },
  rejected: { cls: "status-flag", label: "Rejected", icon: Icons.X },
}

const METHOD_LABEL: Record<GovMethod, string> = {
  email: "Email",
  cold_outreach: "Cold outreach",
}

const CHECKS: readonly GovVerificationCheck[] = ["linkedin", "directory", "callback"]

function GovClaimRow({
  item,
  selected,
  onSelect,
}: {
  item: GovClaimDTO
  selected: boolean
  onSelect: (id: string) => void
}) {
  const status = STATUS_VIEW[item.status]
  const StatusIco = status.icon
  const total = item.verified.length + item.pending.length
  const allVerified = item.pending.length === 0 && total > 0
  return (
    <div className={`qrow gov-claim-row ${selected ? "selected" : ""}`} onClick={() => onSelect(item.id)}>
      <span className="prow-ico hue-sky" title={METHOD_LABEL[item.method]}>
        <Icons.Building size={15} />
      </span>
      <div className="body">
        <div className="top">
          <span className="title">{item.name}</span>
          <span className="pill category">{METHOD_LABEL[item.method]}</span>
          <span className={`pill ${status.cls} tight`}>
            <StatusIco size={9} /> {status.label}
          </span>
        </div>
        <div className="sub">
          <span className="strong">{item.org}</span>
          <span className="sep">·</span>
          <span>{item.title}</span>
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${allVerified ? "status-ok" : "status-progress"} tight`}>
          {item.verified.length}/{total} checks
        </span>
        <span className="age">{item.age}</span>
      </div>
    </div>
  )
}

const GovClaimRowMemo = React.memo(GovClaimRow)

function CheckRow({
  check,
  claim,
  busy,
  onToggle,
}: {
  check: GovVerificationCheck
  claim: GovClaimDTO
  busy: boolean
  onToggle: (check: GovVerificationCheck) => void
}) {
  const data = claim.checks[check]
  const verified = data.status === "verified"
  const detail = data.evidence ?? data.note ?? (verified ? "Verified" : "Awaiting verification")
  return (
    <div className="prow">
      <span className={`prow-ico ${verified ? "hue-moss" : "hue-sun"}`}>
        {verified ? <Icons.Check size={14} /> : <Icons.Clock size={14} />}
      </span>
      <div className="prow-body">
        <div className="prow-title">{GOV_VERIFICATION_CHECK_LABELS[check]}</div>
        <div className="prow-meta">{detail}</div>
      </div>
      <button className="btn sm" disabled={busy} onClick={() => onToggle(check)}>
        {verified ? "Set pending" : "Verify"}
      </button>
    </div>
  )
}

function GovClaimDetail({ itemId }: { itemId: string }) {
  const q = useGovClaim(itemId)
  const toast = useToast()

  const verify = useVerifyGovCheck()
  const approve = useApproveGovClaim()
  const reject = useRejectGovClaim()

  const busy = verify.isPending || approve.isPending || reject.isPending

  if (q.isLoading) return <LoadingState label="Loading claim..." />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const claim: GovClaimDTO | undefined = q.data
  if (!claim)
    return (
      <EmptyState
        title="Claim not found"
        sub="This claim may already have been resolved."
        icon={<Icons.Building size={20} />}
      />
    )

  const status = STATUS_VIEW[claim.status]
  const StatusIco = status.icon

  const onToggleCheck = async (check: GovVerificationCheck) => {
    const label = GOV_VERIFICATION_CHECK_LABELS[check]
    if (claim.checks[check].status === "verified") {
      verify.mutate(
        { id: claim.id, check, status: "pending" },
        { onSuccess: () => toast(`${label} · set to pending`) },
      )
      return
    }
    const evidence = await promptDialog({
      title: `Verify ${label}`,
      label: "Evidence / note (optional)",
    })
    if (evidence === null) return
    verify.mutate(
      { id: claim.id, check, status: "verified", ...(evidence ? { evidence } : {}) },
      { onSuccess: () => toast(`${label} · verified`) },
    )
  }

  const onApprove = async () => {
    const ok = await confirmDialog({
      title: "Provision gov admin?",
      body: `This grants gov_admin access for ${claim.org} and links the jurisdiction. Verify all checks first.`,
      danger: true,
      confirmLabel: "Approve",
    })
    if (!ok) return
    const note = await promptDialog({ title: "Approve claim", label: "Note (optional)" })
    if (note === null) return
    approve.mutate(
      { id: claim.id, ...(note ? { note } : {}) },
      { onSuccess: () => toast(`${claim.org} · gov admin provisioned`) },
    )
  }

  const onReject = async () => {
    const reason = await promptDialog({ title: "Reject claim", label: "Reason", required: true })
    if (reason === null) return
    reject.mutate(
      { id: claim.id, reason },
      { onSuccess: () => toast(`${claim.name} · claim rejected`) },
    )
  }

  return (
    <div className="rep-detail">
      <div className="rep-head">
        <span className="rep-head-pin">
          <Icons.Building size={22} />
        </span>
        <div className="rep-head-text">
          <div className="crumb">
            Gov claim · {METHOD_LABEL[claim.method]} · {claim.age}
          </div>
          <h2>{claim.name}</h2>
        </div>
        <span className={`pill ${status.cls}`} style={{ marginLeft: "auto" }}>
          <StatusIco size={11} /> {status.label}
        </span>
      </div>

      <div className="rep-grid">
        <div className="rep-col">
          <div className="sub">
            <div className="sub-head">Applicant</div>
            <div className="sub-body">
              <div className="user-meta-rows">
                <div className="umr">
                  <span>Title</span>
                  <span className="strong">{claim.title}</span>
                </div>
                <div className="umr">
                  <span>Organization</span>
                  <span className="strong">{claim.org}</span>
                </div>
                <div className="umr">
                  <span>Contact</span>
                  <span className="mono">{claim.contactEmail}</span>
                </div>
                <div className="umr">
                  <span>Jurisdiction</span>
                  <span className="mono">{claim.jurisdictionGeoid ?? "Unmapped"}</span>
                </div>
                <div className="umr">
                  <span>Method</span>
                  <span>{METHOD_LABEL[claim.method]}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rep-col">
          <div className="sub">
            <div className="sub-head">
              Verification
              <span className={`pill ${claim.pending.length === 0 ? "status-ok" : "attention"} tight`}>
                {claim.verified.length}/{CHECKS.length} verified
              </span>
            </div>
            <div className="sub-body">
              {CHECKS.map((check) => (
                <CheckRow
                  key={check}
                  check={check}
                  claim={claim}
                  busy={busy}
                  onToggle={onToggleCheck}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {claim.status === "pending" && (
        <div className="rep-actions">
          <span className="rep-actions-label">Decision</span>
          <button className="btn sm primary" disabled={busy} onClick={onApprove}>
            <Icons.Check size={11} /> Approve &amp; provision
          </button>
          <div className="spacer" />
          <button className="btn danger" disabled={busy} onClick={onReject}>
            <Icons.X size={13} /> Reject
          </button>
        </div>
      )}
    </div>
  )
}

export function GovPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<FilterValue>("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const debouncedQuery = useDebounced(query, 250)

  const listParams = {
    ...(filter !== "all" ? { filter } : {}),
    ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
  }
  const listQuery = useGovClaimList(listParams)
  const items = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data])

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.id)
    if (selId && items.length && !items.some((x) => x.id === selId)) setSelId(items[0]!.id)
  }, [items, selId])

  return (
    <>
      <PageHead
        title="Gov claims"
        subtitle={
          <span>
            Government-admin access claims — applicants who want to manage a jurisdiction. Verify the
            LinkedIn, directory, and callback checks, then approve to provision gov_admin access, or
            reject with a reason.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={[
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as FilterValue)}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            placeholder="Search name, org, email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Claims</h3>
            <div className="spacer" />
            <span className="meta">{items.length}</span>
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading claims..." />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                title="No claims"
                sub="No government-admin claims match this view."
                icon={<Icons.Building size={20} />}
              />
            ) : (
              items.map((c) => (
                <GovClaimRowMemo
                  key={c.id}
                  item={c}
                  selected={selId === c.id}
                  onSelect={setSelId}
                />
              ))
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            <GovClaimDetail key={selId} itemId={selId} />
          ) : (
            <EmptyState
              title="No claim selected"
              sub="Pick a claim from the list."
              icon={<Icons.Building size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

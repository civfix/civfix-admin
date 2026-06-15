"use client"

import * as React from "react"
import {
  GOV_VERIFICATION_CHECK_LABELS,
  type GovCheck,
  type GovCheckStatus,
  type GovClaimDTO,
  type GovClaimStatus,
  type GovMethod,
  type GovVerificationCheck,
} from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import {
  useApproveGovClaim,
  useGovClaim,
  useGovClaimList,
  useRejectGovClaim,
  useVerifyGovClaim,
} from "@/features/government/use-government"
import { useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Government / gov-provisioning queue + detail (ported from data.js govQueue[*] + the .gov-claim CSS,
 * enumeration 2.H). This route was a DEAD LINK in the prototype (only GovRow + the CSS shipped, no page);
 * it is a first-class master-detail route here: the claims queue on the left and the verification surface
 * on the right (applicant identity, how they arrived, the three verification checks - LinkedIn, municipal
 * Directory, phone Callback - each toggleable verified/pending with evidence, and the approve / reject
 * actions). Approving provisions a gov_admin linked to the jurisdiction; rejecting needs a reason. All
 * wired to the typed admin client.
 *
 * On approve/reject the claim resolves and clears from the queue: the mutation invalidates the gov list
 * (which refetches without the resolved claim) and we drop the selection so the first remaining row is
 * selected.
 */

/** The fixed order of the three verification checks, with the icon used to label each. */
const CHECK_ORDER: GovVerificationCheck[] = ["linkedin", "directory", "callback"]
const CHECK_ICON: Record<GovVerificationCheck, IconComponent> = {
  linkedin: Icons.ExternalLink,
  directory: Icons.Building,
  callback: Icons.Phone,
}

/** Claim-status pill treatment for the row trailing band + the detail head. */
const CLAIM_STATUS_CLS: Record<GovClaimStatus, string> = {
  pending: "status-progress",
  approved: "status-ok",
  rejected: "status-flag",
}
const CLAIM_STATUS_LABELS: Record<GovClaimStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
}

const METHOD_LABELS: Record<GovMethod, string> = {
  email: "Inbound email",
  cold_outreach: "Cold outreach",
}

/**
 * Debounce a rapidly-changing value: returns `value` only after it has stayed put for `delayMs`.
 * Used for the search box so a multi-character search term produces a single settled query key
 * instead of one GET per keystroke (each distinct `q` is a fresh React Query cache key, so an
 * un-debounced input floods the backend with intermediate, immediately-discarded result sets).
 * The input keeps `value={query}` for instant typing; only this debounced value reaches listParams.q.
 */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/** One verification-check row (reuses the .prow profile-row primitive): icon, label + status pill,
 * evidence/note, and a verify/unverify toggle. */
function CheckRow({
  check,
  state,
  pending,
  onToggle,
}: {
  check: GovVerificationCheck
  state: GovCheck
  pending: boolean
  onToggle: (next: GovCheckStatus) => void
}) {
  const Ico = CHECK_ICON[check]
  const verified = state.status === "verified"
  return (
    <div className="prow">
      <span className={`prow-ico ${verified ? "hue-moss" : "hue-sun"}`}>
        <Ico size={14} />
      </span>
      <div className="prow-body">
        <div className="prow-title">
          {GOV_VERIFICATION_CHECK_LABELS[check]}
          <span className={`pill ${verified ? "status-ok" : "priority-low"} tight`} style={{ marginLeft: 8 }}>
            {verified ? <Icons.Check size={9} /> : <Icons.Clock size={9} />}
            {verified ? "Verified" : "Pending"}
          </span>
        </div>
        <div className={`prow-meta ${state.evidence ? "mono" : "muted"}`}>
          {state.evidence ?? "No evidence yet"}
          {state.note ? ` · ${state.note}` : ""}
        </div>
      </div>
      <button
        className={`btn sm ${verified ? "ghost" : "primary"}`}
        disabled={pending}
        onClick={() => onToggle(verified ? "pending" : "verified")}
      >
        {verified ? "Unverify" : "Verify"}
      </button>
    </div>
  )
}

function GovClaimDetail({ claimId, onResolved }: { claimId: string; onResolved: (id: string) => void }) {
  const q = useGovClaim(claimId)
  const toast = useToast()

  const verify = useVerifyGovClaim()
  const approve = useApproveGovClaim()
  const reject = useRejectGovClaim()

  if (q.isLoading) return <LoadingState label="Loading claim..." />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const claim = q.data
  if (!claim) {
    return (
      <EmptyState
        title="No claim selected"
        sub="Pick a claim from the queue."
        icon={<Icons.Building size={20} />}
      />
    )
  }

  const allVerified = CHECK_ORDER.every((c) => claim.checks[c].status === "verified")
  const resolved = claim.status !== "pending"
  const acting = verify.isPending || approve.isPending || reject.isPending

  const onToggleCheck = (check: GovVerificationCheck, next: GovCheckStatus) => {
    verify.mutate(
      { id: claim.id, check, status: next },
      {
        onSuccess: () =>
          toast(
            `${claim.id} · ${GOV_VERIFICATION_CHECK_LABELS[check]} ${
              next === "verified" ? "verified" : "cleared"
            }`,
          ),
      },
    )
  }

  const onApprove = () => {
    if (
      !window.confirm(
        `Approve ${claim.name}? This provisions a gov_admin for ${claim.org} linked to the jurisdiction.`,
      )
    )
      return
    approve.mutate(
      { id: claim.id },
      {
        onSuccess: () => {
          toast(`${claim.id} · approved, gov_admin provisioned`)
          onResolved(claim.id)
        },
      },
    )
  }

  const onReject = () => {
    const reason = window.prompt(`Reject ${claim.name}? Add a reason (sent to the applicant):`)
    if (reason === null) return
    const trimmed = reason.trim()
    if (!trimmed) return
    reject.mutate(
      { id: claim.id, reason: trimmed },
      {
        onSuccess: () => {
          toast(`${claim.id} · rejected`)
          onResolved(claim.id)
        },
      },
    )
  }

  return (
    <div className="rep-detail">
      <div className="rep-head">
        <span
          className="user-av lg"
          style={{ background: "linear-gradient(135deg, var(--sky) 0%, var(--lilac) 100%)" }}
        >
          {initials(claim.name)}
        </span>
        <div className="rep-head-text">
          <div className="crumb">
            {claim.id} · Gov claim · {METHOD_LABELS[claim.method]}
          </div>
          <h2>{claim.name}</h2>
        </div>
        <span className={`pill ${CLAIM_STATUS_CLS[claim.status]}`} style={{ marginLeft: "auto" }}>
          {CLAIM_STATUS_LABELS[claim.status]}
        </span>
      </div>

      <div className="rep-grid">
        <div className="rep-col">
          <div className="sub">
            <div className="sub-head">Applicant</div>
            <div className="sub-body">
              <div className="user-meta-rows boxed">
                <div className="umr">
                  <span>Title</span>
                  <span className="strong">{claim.title}</span>
                </div>
                <div className="umr">
                  <span>Organization</span>
                  <span className="strong">{claim.org}</span>
                </div>
                <div className="umr">
                  <span>Jurisdiction</span>
                  <span className="mono">{claim.jurisdictionGeoid ?? "Not linked"}</span>
                </div>
                <div className="umr">
                  <span>Contact</span>
                  <span className="mono">{claim.contactEmail}</span>
                </div>
                <div className="umr">
                  <span>How they arrived</span>
                  <span>{METHOD_LABELS[claim.method]}</span>
                </div>
                <div className="umr">
                  <span>In queue</span>
                  <span>{claim.age}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rep-col">
          <div className="sub">
            <div className="sub-head">
              Verification
              <span className="rep-confirms" style={{ marginLeft: "auto" }}>
                <Icons.Shield size={12} />{" "}
                {CHECK_ORDER.filter((c) => claim.checks[c].status === "verified").length} of{" "}
                {CHECK_ORDER.length} verified
              </span>
            </div>
            <div className="sub-body">
              {CHECK_ORDER.map((c) => (
                <CheckRow
                  key={c}
                  check={c}
                  state={claim.checks[c]}
                  pending={acting}
                  onToggle={(next) => onToggleCheck(c, next)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rep-actions">
        <span className="rep-actions-label">
          {resolved
            ? `Claim ${CLAIM_STATUS_LABELS[claim.status].toLowerCase()}`
            : allVerified
              ? "All checks verified"
              : "Verify all three checks to approve"}
        </span>
        <div className="spacer" />
        <button className="btn danger" disabled={acting || resolved} onClick={onReject}>
          <Icons.X size={13} /> Reject
        </button>
        <button
          className="btn primary"
          disabled={acting || resolved || !allVerified}
          onClick={onApprove}
          title={allVerified ? "" : "Verify all three checks first"}
        >
          <Icons.Check size={13} /> Approve and provision
        </button>
      </div>
    </div>
  )
}

function GovRow({
  claim,
  selected,
  onClick,
}: {
  claim: GovClaimDTO
  selected: boolean
  onClick: () => void
}) {
  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={onClick}>
      <span
        className="user-av"
        style={{ background: "linear-gradient(135deg, var(--sky) 0%, var(--lilac) 100%)" }}
      >
        {initials(claim.name)}
      </span>
      <div className="body">
        <div className="top">
          <span className="title">{claim.name}</span>
          <span className="ident">{claim.id}</span>
        </div>
        <div className="sub">
          <span>{claim.title}</span>
          <span className="sep">·</span>
          <span className="strong">{claim.org}</span>
        </div>
        <div className="sub" style={{ marginTop: 4, gap: 4, flexWrap: "wrap" }}>
          {claim.verified.map((v) => (
            <span key={v} className="pill status-ok tight">
              <Icons.Check size={9} /> {GOV_VERIFICATION_CHECK_LABELS[v]}
            </span>
          ))}
          {claim.pending.map((v) => (
            <span key={v} className="pill priority-low tight">
              <Icons.Clock size={9} /> {GOV_VERIFICATION_CHECK_LABELS[v]}
            </span>
          ))}
        </div>
      </div>
      <div className="trailing">
        <span className="age">{claim.age}</span>
      </div>
    </div>
  )
}

export function GovernmentPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  // Only the settled search term reaches the query key (see useDebouncedValue) — typing stays instant
  // via value={query} below, but the list refetch fires once after the user pauses, not per keystroke.
  const debouncedQuery = useDebouncedValue(query, 300)

  const listParams = {
    filter: filter === "all" ? undefined : (filter as "pending" | "approved" | "rejected"),
    q: debouncedQuery.trim() || undefined,
  }
  const listQuery = useGovClaimList(listParams)
  const items = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data])

  // Unfiltered fetch for stable chip counts across filters.
  const allQuery = useGovClaimList({})
  const allItems = React.useMemo(() => allQuery.data?.items ?? [], [allQuery.data])
  const counts = {
    all: allItems.length,
    pending: allItems.filter((c) => c.status === "pending").length,
    approved: allItems.filter((c) => c.status === "approved").length,
    rejected: allItems.filter((c) => c.status === "rejected").length,
  }

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.id)
    if (selId && items.length && !items.some((x) => x.id === selId)) setSelId(items[0]!.id)
  }, [items, selId])

  // After approve/reject the claim clears from the queue; drop the selection so the effect re-selects.
  const onResolved = (id: string) => {
    setSelId((cur) => (cur === id ? null : cur))
  }

  return (
    <>
      <PageHead
        title="Government"
        subtitle={
          <span>
            Operators verify municipal officials — LinkedIn, directory, phone callback — then provision a
            gov_admin linked to the jurisdiction.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "pending", label: "Pending", count: counts.pending },
            { value: "approved", label: "Approved", count: counts.approved },
            { value: "rejected", label: "Rejected", count: counts.rejected },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            placeholder="Search name, org…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Gov claims</h3>
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
                sub="Nothing awaiting verification."
                icon={<Icons.Building size={20} />}
              />
            ) : (
              items.map((c) => (
                <GovRow
                  key={c.id}
                  claim={c}
                  selected={selId === c.id}
                  onClick={() => setSelId(c.id)}
                />
              ))
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            <GovClaimDetail key={selId} claimId={selId} onResolved={onResolved} />
          ) : (
            <EmptyState
              title="No claim selected"
              sub="Pick a claim from the queue."
              icon={<Icons.Building size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

"use client"

import * as React from "react"
import type { EligibilityVerdict } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { formatDateTime } from "@/lib/dates"
import {
  disabledReasonLabel,
  eligibilityVerdictView,
  paymentsStateView,
} from "@/lib/payments-view"
import { EligibilityEvidenceRow } from "@/components/shared/eligibility-evidence"
import { mnosCheckLog } from "@/features/donations/donations-reporting"
import { usePaymentsEligibilityInfinite } from "@/features/donations/use-donations"
import { useNav } from "@/store/ui-store"

const VERDICT_FILTERS: { value: string; label: string; verdict?: EligibilityVerdict }[] = [
  { value: "all", label: "All" },
  { value: "ineligible", label: "Ineligible", verdict: "ineligible" },
  { value: "grace", label: "Grace", verdict: "grace" },
  { value: "review_required", label: "Review required", verdict: "review_required" },
  { value: "eligible", label: "Eligible", verdict: "eligible" },
  { value: "unknown", label: "Unknown", verdict: "unknown" },
]

export function EligibilityQueue() {
  const [filter, setFilter] = React.useState("all")
  const nav = useNav()
  const verdict = VERDICT_FILTERS.find((f) => f.value === filter)?.verdict
  const q = usePaymentsEligibilityInfinite({ verdict })
  const rows = React.useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data])
  const counts = q.data?.pages[0]?.counts
  const mnos = React.useMemo(() => mnosCheckLog(rows), [rows])

  return (
    <>
      <div className="toolbar">
        <FilterChips
          options={VERDICT_FILTERS.map((f) => ({
            value: f.value,
            label: f.label,
            count:
              counts === undefined
                ? undefined
                : f.value === "all"
                  ? undefined
                  : f.value === "review_required"
                    ? counts.reviewRequired
                    : counts[f.value as "eligible" | "grace" | "ineligible" | "unknown"],
          }))}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Eligibility</h3>
          <div className="spacer" />
          <span className="meta">{rows.length}</span>
        </div>
        <div className="queue-list">
          {q.isLoading ? (
            <LoadingState label="Loading eligibility..." />
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : (
            <>
              {rows.length === 0 && (
                <EmptyState
                  title="Nothing loaded here"
                  sub="No organization on the loaded pages matches this eligibility verdict."
                  icon={<Icons.Shield size={20} />}
                />
              )}
              {rows.map((row) => {
                const view = eligibilityVerdictView(row.eligibility.verdict)
                const state = paymentsStateView(
                  row.paymentsState,
                  row.donationsEnabled,
                  row.donationsDisabledReason,
                )
                const disabledReason = disabledReasonLabel(row.donationsDisabledReason)
                return (
                  <div
                    key={row.organizationId}
                    className="qrow"
                    onClick={() => nav("orgs", row.organizationId)}
                  >
                    <div className="leading">
                      <span className="evt-row-ico hue-moss" title="Organization">
                        <Icons.Building size={15} />
                      </span>
                    </div>
                    <div className="body">
                      <div className="top">
                        <span className="title">{row.orgName}</span>
                        <span className="ident">/{row.orgSlug}</span>
                      </div>
                      <div className="sub">
                        <span className="strong">
                          {row.eligibility.irsLegalName ?? "No IRS legal name on file"}
                        </span>
                        <span className="sep">·</span>
                        <span>Next check {formatDateTime(row.eligibility.nextCheckAt)}</span>
                        {row.eligibility.graceExpiresAt && (
                          <>
                            <span className="sep">·</span>
                            <span>
                              Grace ends {formatDateTime(row.eligibility.graceExpiresAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="trailing">
                      {!row.donationsEnabled && (
                        <span className="pill priority-low tight" title={disabledReason ?? undefined}>
                          Donations off
                        </span>
                      )}
                      <span className={`pill ${state.cls} tight`}>{state.label}</span>
                      <span className={`pill ${view.cls} tight`}>{view.label}</span>
                    </div>
                  </div>
                )
              })}
              {q.hasNextPage && (
                <button
                  type="button"
                  className="btn load-more"
                  disabled={q.isFetchingNextPage}
                  onClick={() => void q.fetchNextPage()}
                >
                  {q.isFetchingNextPage ? "Loading…" : "Load more"}
                </button>
              )}
            </>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>MNOS check log</h3>
          <div className="spacer" />
          <span className="meta">{mnos.length}</span>
        </div>
        <div className="card-pad">
          {q.isLoading ? (
            <LoadingState label="Loading checks..." />
          ) : q.isError ? (
            <ErrorState
              error={q.error}
              onRetry={() => q.refetch()}
              title="Could not read the eligibility evidence"
            />
          ) : mnos.length === 0 ? (
            <EmptyState
              title="No MNOS evidence loaded"
              sub="The CA AG May Not Operate or Solicit list has produced no evidence rows for the organizations loaded here."
              icon={<Icons.Shield size={20} />}
            />
          ) : (
            <div className="pay-evidence-list">
              {mnos.map((entry, index) => (
                <div key={`${entry.organizationId}-${entry.check.checkedAt}-${index}`}>
                  <div className="don-mnos-org">
                    <span
                      className="lnk-inline"
                      role="button"
                      tabIndex={0}
                      onClick={() => nav("orgs", entry.organizationId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") nav("orgs", entry.organizationId)
                      }}
                    >
                      {entry.orgName}
                    </span>
                    <span className="ident">/{entry.orgSlug}</span>
                  </div>
                  <EligibilityEvidenceRow check={entry.check} />
                </div>
              ))}
            </div>
          )}
          <div className="bcast-note">
            <Icons.Layers size={12} /> This log is derived from the eligibility rows loaded above,
            and each organization contributes only the most recent checks the server returns. Load
            more organizations to widen it; it is not a complete platform-wide check history.
          </div>
        </div>
      </section>
    </>
  )
}

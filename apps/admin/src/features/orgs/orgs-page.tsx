"use client"

import * as React from "react"
import type { AdminOrgVerificationListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { useDebounced } from "@/hooks/use-debounced"
import { formatDate } from "@/lib/dates"
import { PaymentsPanel } from "@/features/orgs/payments-panel"
import {
  ORG_KIND_LABEL,
  ORG_STATUS_VIEW,
  VerificationPanel,
} from "@/features/orgs/verification-panel"
import { orgStatusFilterParam } from "@/features/orgs/orgs-filters"
import { useOrgVerificationsInfinite } from "@/features/orgs/use-orgs"
import type { SectionPageProps } from "@/components/shell/page-registry"

type DetailTab = "verification" | "payments"

function OrgRow({
  item,
  selected,
  onClick,
}: {
  item: AdminOrgVerificationListItemDTO
  selected: boolean
  onClick: () => void
}) {
  const view = ORG_STATUS_VIEW[item.status]
  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={onClick}>
      <div className="leading">
        <span className="evt-row-ico hue-sky" title="Organization">
          <Icons.Building size={15} />
        </span>
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{item.name}</span>
          <span className="ident">/{item.slug}</span>
        </div>
        <div className="sub">
          <span className="strong">{item.kind ? ORG_KIND_LABEL[item.kind] : "No kind"}</span>
          <span className="sep">·</span>
          <span>
            {item.documentMediaIds.length}{" "}
            {item.documentMediaIds.length === 1 ? "document" : "documents"}
          </span>
          {item.submittedBy && (
            <>
              <span className="sep">·</span>
              <span>{item.submittedBy.name}</span>
            </>
          )}
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${view.cls} tight`}>{view.label}</span>
        <span className="age">{formatDate(item.submittedAt)}</span>
      </div>
    </div>
  )
}

export function OrgsPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<string>("pending")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)
  const [tab, setTab] = React.useState<DetailTab>("verification")

  const debouncedQuery = useDebounced(query, 250)
  const listParams = React.useMemo(
    () => ({
      status: orgStatusFilterParam(filter),
      q: debouncedQuery.trim() === "" ? undefined : debouncedQuery.trim(),
    }),
    [filter, debouncedQuery],
  )
  const listQuery = useOrgVerificationsInfinite(listParams)
  const items = React.useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  )
  const pendingCount = listQuery.data?.pages[0]?.pendingCount

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.organizationId)
  }, [items, selId])

  return (
    <>
      <PageHead
        title="Organizations"
        subtitle={
          <span>
            Nonprofits, agencies and community groups that host on civfix. Verify who they say they
            are, and hold the switch on their donations.
          </span>
        }
        meta={
          pendingCount !== undefined ? (
            <span>
              {pendingCount} awaiting review
            </span>
          ) : undefined
        }
      />

      <div className="toolbar">
        <FilterChips
          options={[
            { value: "all", label: "All" },
            { value: "pending", label: "Pending", count: pendingCount },
            { value: "verified", label: "Verified" },
            { value: "rejected", label: "Rejected" },
            { value: "unverified", label: "Unverified" },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            placeholder="Search name or slug…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Verification queue</h3>
            <div className="spacer" />
            <span className="meta">{items.length}</span>
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading organizations..." />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : (
              <>
                {items.length === 0 ? (
                  <EmptyState
                    title="Nothing loaded here"
                    sub="No organization on the loaded pages matches this filter or search."
                    icon={<Icons.Building size={20} />}
                  />
                ) : (
                  items.map((o) => (
                    <OrgRow
                      key={o.organizationId}
                      item={o}
                      selected={selId === o.organizationId}
                      onClick={() => setSelId(o.organizationId)}
                    />
                  ))
                )}
                {listQuery.hasNextPage && (
                  <button
                    type="button"
                    className="btn load-more"
                    disabled={listQuery.isFetchingNextPage}
                    onClick={() => void listQuery.fetchNextPage()}
                  >
                    {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            <div className="rep-detail">
              <div className="profile-tabs">
                <button
                  type="button"
                  className={`profile-tab ${tab === "verification" ? "active" : ""}`}
                  onClick={() => setTab("verification")}
                >
                  Verification
                </button>
                <button
                  type="button"
                  className={`profile-tab ${tab === "payments" ? "active" : ""}`}
                  onClick={() => setTab("payments")}
                >
                  Payments
                </button>
              </div>
              {tab === "verification" ? (
                <VerificationPanel key={`v-${selId}`} orgId={selId} />
              ) : (
                <PaymentsPanel key={`p-${selId}`} orgId={selId} />
              )}
            </div>
          ) : (
            <EmptyState
              title="No organization selected"
              sub="Pick an organization from the queue."
              icon={<Icons.Building size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

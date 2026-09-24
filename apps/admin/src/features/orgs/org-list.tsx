"use client"

import type { AdminOrgDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { formatDate } from "@/lib/dates"
import { orgStatusView } from "@/lib/org-status"
import { OrgLogo } from "@/features/orgs/org-logo"
import type { useOrgListInfinite } from "@/features/orgs/use-orgs"

function plural(count: number, one: string, many: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`
}

function OrgRow({
  org,
  selected,
  onClick,
}: {
  org: AdminOrgDTO
  selected: boolean
  onClick: () => void
}) {
  const view = orgStatusView(org.verifiedStatus)
  const suspended = !!org.suspendedAt
  const pendingSince = org.verifiedStatus === "pending" ? org.verification?.submittedAt : undefined
  return (
    <div
      className={`qrow org-row ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        onClick()
      }}
    >
      <div className="leading">
        <OrgLogo org={org} />
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{org.name}</span>
          {suspended && (
            <span className="pill status-flag tight">
              <Icons.Lock size={9} /> Suspended
            </span>
          )}
        </div>
        <div className="sub">
          <span className="mono">/{org.slug}</span>
          <span className="sep">·</span>
          <span className="strong">{plural(org.memberCount, "member", "members")}</span>
          <span className="sep">·</span>
          <span className="count">{plural(org.eventCount, "event", "events")}</span>
          {org.owner && (
            <>
              <span className="sep">·</span>
              <span title={org.owner.handle}>{org.owner.name}</span>
            </>
          )}
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${view.cls} tight`}>{view.label}</span>
        <span className="age">{formatDate(pendingSince || org.createdAt)}</span>
      </div>
    </div>
  )
}

export function OrgList({
  listQuery,
  items,
  pendingView,
  selId,
  onSelect,
}: {
  listQuery: ReturnType<typeof useOrgListInfinite>
  items: AdminOrgDTO[]
  pendingView: boolean
  selId: string | null
  onSelect: (id: string) => void
}) {
  if (listQuery.isLoading) return <LoadingState label="Loading organizations..." />
  if (listQuery.isError) {
    return <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
  }
  return (
    <>
      {items.length === 0 ? (
        <EmptyState
          title={pendingView ? "Queue is clear" : "No organizations"}
          sub={
            pendingView
              ? "No verification application is waiting for a decision."
              : "No organization matches this filter or search."
          }
          icon={<Icons.Building size={20} />}
        />
      ) : (
        items.map((o) => (
          <OrgRow key={o.id} org={o} selected={selId === o.id} onClick={() => onSelect(o.id)} />
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
  )
}

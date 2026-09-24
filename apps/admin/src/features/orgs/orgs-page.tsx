"use client"

import * as React from "react"
import { monogram, type AdminOrgDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { promptDialog } from "@/components/shared/dialog"
import { useDebounced } from "@/hooks/use-debounced"
import { formatDate, formatDateTime } from "@/lib/dates"
import { orgStatusView } from "@/lib/org-status"
import { CreateOrgPanel } from "@/features/orgs/create-org-panel"
import { MembersPanel } from "@/features/orgs/members-panel"
import { OrgEventsPanel } from "@/features/orgs/org-events-panel"
import { ProfilePanel } from "@/features/orgs/profile-panel"
import { ORG_KIND_LABEL } from "@/features/orgs/org-verification"
import { VerificationPanel } from "@/features/orgs/verification-panel"
import {
  ORG_FILTERS,
  ORG_FILTER_LABEL,
  orgFilterCount,
  orgListParams,
} from "@/features/orgs/orgs-filters"
import { parseOrgFocus, type OrgDetailTab } from "@/features/orgs/org-focus"
import { menuFocusIndex } from "@/features/orgs/org-members"
import { publicOrgUrl } from "@/features/orgs/org-slug"
import { useAdminOrg, useOrgsInfinite, useSetOrgSuspended } from "@/features/orgs/use-orgs"
import type { SectionPageProps } from "@/components/shell/page-registry"

const DETAIL_TABS: { id: OrgDetailTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "verification", label: "Verification" },
  { id: "members", label: "Members" },
  { id: "events", label: "Events" },
]

function OrgLogo({ org, size = 32 }: { org: Pick<AdminOrgDTO, "name" | "logoUrl">; size?: number }) {
  const style: React.CSSProperties = { width: size, height: size }
  if (org.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="org-logo" style={style} src={org.logoUrl} alt="" />
  }
  return (
    <span className="org-logo hue-sky" style={{ ...style, fontSize: Math.round(size * 0.42) }}>
      {monogram(org.name)}
    </span>
  )
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
          <span className="strong">
            {org.memberCount.toLocaleString()} {org.memberCount === 1 ? "member" : "members"}
          </span>
          <span className="sep">·</span>
          <span className="count">
            {org.eventCount.toLocaleString()} {org.eventCount === 1 ? "event" : "events"}
          </span>
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
        <span className="age">
          {org.verifiedStatus === "pending" && org.verification?.submittedAt
            ? formatDate(org.verification.submittedAt)
            : formatDate(org.createdAt)}
        </span>
      </div>
    </div>
  )
}

function OrgDetail({
  orgId,
  tab,
  onTab,
}: {
  orgId: string
  tab: OrgDetailTab
  onTab: (t: OrgDetailTab) => void
}) {
  const q = useAdminOrg(orgId)
  const suspend = useSetOrgSuspended()
  // Guards the button against a second click while the reason prompt is open.
  const busy = React.useRef(false)
  const tabIds = React.useId()
  const tabRefs = React.useRef(new Map<OrgDetailTab, HTMLButtonElement>())

  if (q.isLoading) return <LoadingState label="Loading organization..." />
  if (q.isError && !q.data) {
    return (
      <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load this organization" />
    )
  }
  const org = q.data
  if (!org) return null
  const statusView = orgStatusView(org.verifiedStatus)
  const suspended = !!org.suspendedAt
  const tabId = (t: OrgDetailTab) => `${tabIds}-tab-${t}`
  const panelId = `${tabIds}-panel`

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = DETAIL_TABS.findIndex((t) => t.id === tab)
    const next = menuFocusIndex(e.key, current, DETAIL_TABS.length, "horizontal")
    if (next === null) return
    e.preventDefault()
    const target = DETAIL_TABS[next]!.id
    onTab(target)
    tabRefs.current.get(target)?.focus()
  }

  const onSuspend = async () => {
    if (busy.current || suspend.isPending) return
    busy.current = true
    let reason: string | null
    try {
      reason = await promptDialog({
        title: suspended ? `Restore ${org.name}?` : `Suspend ${org.name}?`,
        body: suspended
          ? "Lifting the suspension restores exactly what was there: verification, members and profile settings are untouched. The reason is written to the audit log."
          : "A suspended organization keeps its data and members, but every write under its name — events, broadcasts, invites — is refused until it is restored. Its public page shows a notice. The reason is written to the audit log.",
        label: "Reason (required)",
        placeholder: suspended
          ? "Resolved after the org replaced its contact…"
          : "Repeated broadcast abuse reports; pending review with the org…",
        confirmLabel: suspended ? "Restore organization" : "Suspend organization",
        required: true,
        danger: !suspended,
      })
    } finally {
      busy.current = false
    }
    if (reason === null || reason.trim() === "") return
    suspend.mutate({ id: org.id, suspended: !suspended, reason: reason.trim() })
  }

  return (
    <div className="rep-detail">
      <div className="rep-head org-head">
        <span className="rep-head-pin">
          <OrgLogo org={org} size={36} />
        </span>
        <div className="rep-head-text">
          <div className="crumb">
            /{org.slug}
            {org.verifiedKind ? ` · ${ORG_KIND_LABEL[org.verifiedKind]}` : ""}
          </div>
          <h2>{org.name}</h2>
        </div>
        <div className="org-head-pills">
          {suspended && (
            <span className="pill status-flag">
              <Icons.Lock size={11} /> Suspended
            </span>
          )}
          <span className={`pill ${statusView.cls}`}>{statusView.label}</span>
        </div>
      </div>

      <div className="org-head-actions">
        <a
          className="btn sm ghost"
          href={publicOrgUrl(org.slug)}
          target="_blank"
          rel="noreferrer noopener"
        >
          <Icons.ExternalLink size={13} /> View public page
        </a>
        <div className="spacer" />
        <button
          type="button"
          className={`btn sm ${suspended ? "success" : "danger"}`}
          disabled={suspend.isPending || !!org.deletedAt}
          onClick={() => void onSuspend()}
        >
          <Icons.Lock size={13} /> {suspended ? "Restore" : "Suspend"}
        </button>
      </div>

      {suspended && (
        <div className="org-banner tone-alert" role="status">
          <Icons.AlertTriangle size={14} />
          <div>
            <b>Suspended {formatDateTime(org.suspendedAt)}.</b>{" "}
            {org.suspendedReason ? `“${org.suspendedReason}”` : "No reason recorded."} Writes under
            this organization are refused until it is restored.
          </div>
        </div>
      )}
      {q.isError && (
        <div className="org-banner tone-alert" role="status">
          <Icons.AlertTriangle size={14} />
          <div>
            <b>Could not refresh this organization.</b> Showing what was last loaded.{" "}
            <button type="button" className="btn sm ghost" onClick={() => void q.refetch()}>
              Try again
            </button>
          </div>
        </div>
      )}
      {org.deletedAt && (
        <div className="org-banner" role="status">
          <Icons.Trash size={14} />
          <div>
            <b>Deleted {formatDateTime(org.deletedAt)}.</b> This organization was soft-deleted; it is
            read-only here.
          </div>
        </div>
      )}

      <div className="profile-tabs org-tabs" role="tablist" onKeyDown={onTabKeyDown}>
        {DETAIL_TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              if (el) tabRefs.current.set(t.id, el)
              else tabRefs.current.delete(t.id)
            }}
            id={tabId(t.id)}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={tab === t.id ? panelId : undefined}
            tabIndex={tab === t.id ? 0 : -1}
            className={`profile-tab ${tab === t.id ? "on" : ""}`}
            onClick={() => onTab(t.id)}
          >
            {t.label}
            {t.id === "members" && <span className="profile-tab-n">{org.memberCount}</span>}
            {t.id === "events" && <span className="profile-tab-n">{org.eventCount}</span>}
            {t.id === "verification" && org.verifiedStatus === "pending" && (
              <span className="profile-tab-n" role="img" aria-label="awaiting decision">
                !
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="org-tab-body" role="tabpanel" id={panelId} aria-labelledby={tabId(tab)}>
        {tab === "profile" && <ProfilePanel key={`pr-${org.id}`} org={org} />}
        {tab === "verification" && <VerificationPanel key={`v-${org.id}`} orgId={org.id} />}
        {tab === "members" && <MembersPanel key={`m-${org.id}`} org={org} />}
        {tab === "events" && <OrgEventsPanel key={`e-${org.id}`} org={org} />}
      </div>
    </div>
  )
}

export function OrgsPage({ focusId }: SectionPageProps) {
  const focus = React.useMemo(() => parseOrgFocus(focusId), [focusId])
  const [filter, setFilter] = React.useState<string>("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focus.id)
  const [tab, setTab] = React.useState<OrgDetailTab>(focus.tab ?? "profile")
  const [creating, setCreating] = React.useState(false)

  const debouncedQuery = useDebounced(query, 250)
  const listParams = React.useMemo(
    () => orgListParams(filter, debouncedQuery),
    [filter, debouncedQuery],
  )
  const listQuery = useOrgsInfinite(listParams)
  const items = React.useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  )
  const counts = listQuery.data?.pages[0]?.counts
  const pendingCount = counts?.pending

  React.useEffect(() => {
    if (focus.id) setSelId(focus.id)
    if (focus.tab) setTab(focus.tab)
  }, [focus])
  // Only the first load picks an org on the operator's behalf; a deep-linked or just-created org is
  // pinned like any other pick. A pick that a filter or search leaves out stays open (the detail reads it
  // by id); a pick that drops out of the same list after a refetch (a verification decision under the
  // Pending chip) clears, so the pane never jumps to another org's actions. Each decision waits for data
  // fetched for the current params: a cached page that is refetching may not have the org created since.
  const listKey = JSON.stringify(listParams)
  const [autoPick, setAutoPick] = React.useState(focus.id === null)
  const seenIn = React.useRef<{ id: string; list: string } | null>(null)
  React.useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isFetching) return
    if (selId === null) {
      if (autoPick && items.length) setSelId(items[0]!.id)
      return
    }
    setAutoPick(false)
    if (items.some((o) => o.id === selId)) seenIn.current = { id: selId, list: listKey }
    else if (seenIn.current?.id === selId && seenIn.current.list === listKey) setSelId(null)
  }, [listQuery.isSuccess, listQuery.isFetching, items, selId, listKey, autoPick])

  const pickFilter = (next: string) => {
    setFilter(next)
    // The verification queue opens on the decision, everything else on the profile.
    if (next === "pending") setTab("verification")
    else if (tab === "verification") setTab("profile")
  }

  return (
    <>
      <PageHead
        title="Organizations"
        subtitle={
          <span>
            Nonprofits, agencies and community groups that host on civfix. Create and manage them,
            verify who they say they are, and keep their members and events in order.
          </span>
        }
        meta={pendingCount !== undefined ? <span>{pendingCount} awaiting review</span> : undefined}
      >
        <button type="button" className="btn primary" onClick={() => setCreating(true)}>
          <Icons.Plus size={14} /> New organization
        </button>
      </PageHead>

      <div className="toolbar">
        <FilterChips
          options={ORG_FILTERS.map((f) => ({
            value: f,
            label: ORG_FILTER_LABEL[f],
            count: orgFilterCount(counts, f),
          }))}
          value={filter}
          onChange={pickFilter}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            aria-label="Search organizations"
            placeholder="Search name or slug…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>{filter === "pending" ? "Verification queue" : "Organizations"}</h3>
            <div className="spacer" />
            <span className="meta">
              {items.length}
              {counts && filter !== "rejected" && filter !== "unverified"
                ? ` of ${orgFilterCount(counts, filter as (typeof ORG_FILTERS)[number]) ?? items.length}`
                : ""}
            </span>
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
                    title={filter === "pending" ? "Queue is clear" : "No organizations"}
                    sub={
                      filter === "pending"
                        ? "No verification application is waiting for a decision."
                        : "No organization matches this filter or search."
                    }
                    icon={<Icons.Building size={20} />}
                  />
                ) : (
                  items.map((o) => (
                    <OrgRow
                      key={o.id}
                      org={o}
                      selected={selId === o.id}
                      onClick={() => setSelId(o.id)}
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
            <OrgDetail key={selId} orgId={selId} tab={tab} onTab={setTab} />
          ) : (
            <EmptyState
              title="No organization selected"
              sub="Pick an organization from the list, or create one."
              icon={<Icons.Building size={20} />}
            />
          )}
        </section>
      </div>

      <CreateOrgPanel
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(org) => {
          setCreating(false)
          if (filter !== "all") setFilter("all")
          setQuery("")
          setTab("profile")
          setSelId(org.id)
        }}
      />
    </>
  )
}

"use client"

import * as React from "react"
import type { AdminOrgDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { promptDialog } from "@/components/shared/dialog"
import { formatDateTime } from "@/lib/dates"
import { orgStatusView } from "@/lib/org-status"
import { MembersPanel } from "@/features/orgs/members-panel"
import { OrgEventsPanel } from "@/features/orgs/org-events-panel"
import { ORG_DETAIL_TABS, type OrgDetailTab } from "@/features/orgs/org-focus"
import { ORG_LOGO_HEADER_SIZE, OrgLogo } from "@/features/orgs/org-logo"
import { menuFocusIndex } from "@/features/orgs/org-members"
import { publicOrgUrl } from "@/features/orgs/org-slug"
import { ORG_KIND_LABEL } from "@/features/orgs/org-verification"
import { ProfilePanel } from "@/features/orgs/profile-panel"
import { useAdminOrg, useSetOrgSuspended } from "@/features/orgs/use-orgs"
import { VerificationPanel } from "@/features/orgs/verification-panel"

const TAB_LABEL: Record<OrgDetailTab, string> = {
  profile: "Profile",
  verification: "Verification",
  members: "Members",
  events: "Events",
}

function SuspendButton({ org }: { org: AdminOrgDTO }) {
  const suspend = useSetOrgSuspended()
  // Guards the button against a second click while the reason prompt is open.
  const busy = React.useRef(false)
  const suspended = !!org.suspendedAt

  const onSuspend = async () => {
    if (busy.current || suspend.isPending) return
    busy.current = true
    let reason: string | null
    try {
      reason = await promptDialog({
        title: suspended ? `Restore ${org.name}?` : `Suspend ${org.name}?`,
        body: suspended
          ? "Lifting the suspension restores exactly what was there: verification, members and profile settings are untouched. The reason is written to the audit log."
          : "A suspended organization keeps its data and members, but every write under its name (events, broadcasts, invites) is refused until it is restored. Its public page shows a notice. The reason is written to the audit log.",
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
    <button
      type="button"
      className={`btn sm ${suspended ? "success" : "danger"}`}
      disabled={suspend.isPending || !!org.deletedAt}
      onClick={() => void onSuspend()}
    >
      <Icons.Lock size={13} /> {suspended ? "Restore" : "Suspend"}
    </button>
  )
}

function OrgDetailHeader({ org }: { org: AdminOrgDTO }) {
  const statusView = orgStatusView(org.verifiedStatus)
  return (
    <>
      <div className="rep-head org-head">
        <span className="rep-head-pin">
          <OrgLogo org={org} size={ORG_LOGO_HEADER_SIZE} />
        </span>
        <div className="rep-head-text">
          <div className="crumb">
            /{org.slug}
            {org.verifiedKind ? ` · ${ORG_KIND_LABEL[org.verifiedKind]}` : ""}
          </div>
          <h2>{org.name}</h2>
        </div>
        <div className="org-head-pills">
          {!!org.suspendedAt && (
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
        <SuspendButton org={org} />
      </div>
    </>
  )
}

function OrgBanners({
  org,
  refreshFailed,
  onRetry,
}: {
  org: AdminOrgDTO
  refreshFailed: boolean
  onRetry: () => void
}) {
  return (
    <>
      {!!org.suspendedAt && (
        <div className="org-banner tone-alert" role="status">
          <Icons.AlertTriangle size={14} />
          <div>
            <b>Suspended {formatDateTime(org.suspendedAt)}.</b>{" "}
            {org.suspendedReason ? `“${org.suspendedReason}”` : "No reason recorded."} Writes under
            this organization are refused until it is restored.
          </div>
        </div>
      )}
      {refreshFailed && (
        <div className="org-banner tone-alert" role="status">
          <Icons.AlertTriangle size={14} />
          <div>
            <b>Could not refresh this organization.</b> Showing what was last loaded.{" "}
            <button type="button" className="btn sm ghost" onClick={onRetry}>
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
    </>
  )
}

function TabBadge({ org, tab }: { org: AdminOrgDTO; tab: OrgDetailTab }) {
  if (tab === "members") return <span className="profile-tab-n">{org.memberCount}</span>
  if (tab === "events") return <span className="profile-tab-n">{org.eventCount}</span>
  if (tab === "verification" && org.verifiedStatus === "pending") {
    return (
      <span className="profile-tab-n" role="img" aria-label="awaiting decision">
        !
      </span>
    )
  }
  return null
}

function OrgDetailTabs({
  org,
  tab,
  onTab,
  tabId,
  panelId,
}: {
  org: AdminOrgDTO
  tab: OrgDetailTab
  onTab: (t: OrgDetailTab) => void
  tabId: (t: OrgDetailTab) => string
  panelId: string
}) {
  const tabRefs = React.useRef(new Map<OrgDetailTab, HTMLButtonElement>())

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = ORG_DETAIL_TABS.indexOf(tab)
    const next = menuFocusIndex(e.key, current, ORG_DETAIL_TABS.length, "horizontal")
    if (next === null) return
    e.preventDefault()
    const target = ORG_DETAIL_TABS[next]!
    onTab(target)
    tabRefs.current.get(target)?.focus()
  }

  return (
    <div className="profile-tabs org-tabs" role="tablist" onKeyDown={onTabKeyDown}>
      {ORG_DETAIL_TABS.map((t) => (
        <button
          key={t}
          ref={(el) => {
            if (el) tabRefs.current.set(t, el)
            else tabRefs.current.delete(t)
          }}
          id={tabId(t)}
          type="button"
          role="tab"
          aria-selected={tab === t}
          aria-controls={tab === t ? panelId : undefined}
          tabIndex={tab === t ? 0 : -1}
          className={`profile-tab ${tab === t ? "on" : ""}`}
          onClick={() => onTab(t)}
        >
          {TAB_LABEL[t]}
          <TabBadge org={org} tab={t} />
        </button>
      ))}
    </div>
  )
}

export function OrgDetail({
  orgId,
  tab,
  onTab,
}: {
  orgId: string
  tab: OrgDetailTab
  onTab: (t: OrgDetailTab) => void
}) {
  const q = useAdminOrg(orgId)
  const tabIds = React.useId()

  if (q.isLoading) return <LoadingState label="Loading organization..." />
  if (q.isError && !q.data) {
    return (
      <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load this organization" />
    )
  }
  const org = q.data
  if (!org) return null
  const tabId = (t: OrgDetailTab) => `${tabIds}-tab-${t}`
  const panelId = `${tabIds}-panel`

  return (
    <div className="rep-detail">
      <OrgDetailHeader org={org} />
      <OrgBanners org={org} refreshFailed={q.isError} onRetry={() => void q.refetch()} />
      <OrgDetailTabs org={org} tab={tab} onTab={onTab} tabId={tabId} panelId={panelId} />
      <div className="org-tab-body" role="tabpanel" id={panelId} aria-labelledby={tabId(tab)}>
        {tab === "profile" && <ProfilePanel org={org} />}
        {tab === "verification" && <VerificationPanel orgId={org.id} />}
        {tab === "members" && <MembersPanel org={org} />}
        {tab === "events" && <OrgEventsPanel org={org} />}
      </div>
    </div>
  )
}

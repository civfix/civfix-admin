"use client"

import * as React from "react"
import { RISK_LABELS, type AdminUserDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { isNotFound } from "@/lib/api"
import { formatDate } from "@/lib/dates"
import { EMPTY_VALUE } from "@/lib/empty-value"
import { menuFocusIndex } from "@/features/orgs/org-members"
import { useUser } from "@/features/users/use-users"
import { UserActionsBar, useUserAccountMutations } from "@/features/users/user-actions-bar"
import { UserActivity, type ProfileTab } from "@/features/users/user-activity"
import { UserAvatar } from "@/features/users/user-avatar"
import { isMissing, userStatusView } from "@/features/users/user-display"
import { UserOrganizations } from "@/features/users/user-organizations-card"
import { useNav, useToast } from "@/store/ui-store"

const PROFILE_TABS: readonly { id: ProfileTab; label: string }[] = [
  { id: "reports", label: "Reports" },
  { id: "events", label: "Events" },
  { id: "messages", label: "Messages" },
]

function tabCount(user: AdminUserDTO, tab: ProfileTab): number {
  if (tab === "reports") return user.reports
  if (tab === "events") return user.cleanups
  return user.messages
}

function UserDetailHeader({ user }: { user: AdminUserDTO }) {
  const statusView = userStatusView(user.status)
  return (
    <div className="user-detail-head">
      <UserAvatar user={user} large />

      <div className="udh-text">
        <h2>{user.name}</h2>
        <div className="udh-sub">
          <span className="mono">{isMissing(user.handle) ? EMPTY_VALUE : user.handle}</span>
          {!isMissing(user.city) && (
            <>
              <span className="sep">·</span>
              <span>{user.city}</span>
            </>
          )}
        </div>
      </div>
      <div className="udh-badges">
        {!!user.deletedAt && (
          <span className="pill status-flag tight" title="This account was self-deleted (tombstoned)">
            <Icons.Trash size={11} /> Deleted
          </span>
        )}
        {user.flagged && (
          <span className="pill status-flag">
            <Icons.Flag size={11} /> Flagged
          </span>
        )}
        {!!user.reportVerified && (
          <span
            className="pill status-new"
            title="Report-verified: this reporter's reports auto-forward to their jurisdiction"
          >
            <Icons.Check size={11} /> Report-verified
          </span>
        )}
        <span className={`pill ${statusView.cls}`}>{statusView.label}</span>
      </div>
    </div>
  )
}

function UserProfileMeta({ user }: { user: AdminUserDTO }) {
  const toast = useToast()

  const onCopyId = () => {
    const copyFailed = () => toast("Couldn't copy. Select the ID manually.", "error")
    // The Clipboard API exists only in a secure context; without it nothing is copied.
    if (!navigator.clipboard) {
      copyFailed()
      return
    }
    navigator.clipboard.writeText(user.id).then(() => toast("User ID copied"), copyFailed)
  }

  return (
    <div className="profile-meta">
      <span className="pm-item">
        <Icons.Activity size={13} /> Active {isMissing(user.lastActive) ? "never" : user.lastActive}
      </span>
      <span className="pm-item">
        <Icons.Calendar size={13} /> Joined{" "}
        {isMissing(user.joined) ? "unknown" : formatDate(user.joined)}
      </span>
      {!isMissing(user.city) && (
        <span className="pm-item">
          <Icons.Pin size={13} /> {user.city}
        </span>
      )}
      <span className="pm-item">
        <Icons.AlertTriangle size={13} /> Risk: {RISK_LABELS[user.risk]} · {user.strikes}{" "}
        {user.strikes === 1 ? "strike" : "strikes"} · {user.removals}{" "}
        {user.removals === 1 ? "removal" : "removals"}
      </span>
      <button
        type="button"
        className="pm-item pm-copy"
        onClick={onCopyId}
        title="Copy the raw account UUID (admin/DB only, not shown to neighbors)"
      >
        <Icons.Hash size={13} /> <span className="mono">{user.id}</span>
        <Icons.Copy size={12} />
      </button>
    </div>
  )
}

function UserActivityTabs({
  user,
  tab,
  onTabChange,
}: {
  user: AdminUserDTO
  tab: ProfileTab
  onTabChange: (tab: ProfileTab) => void
}) {
  const tabsId = React.useId()
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  return (
    <>
      <div className="profile-tabs" role="tablist" aria-label="Activity">
        {PROFILE_TABS.map((t, i) => {
          const selected = tab === t.id
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`${tabsId}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${tabsId}-panel`}
              tabIndex={selected ? 0 : -1}
              className={`profile-tab ${selected ? "on" : ""}`}
              onClick={() => onTabChange(t.id)}
              onKeyDown={(e) => {
                const next = menuFocusIndex(e.key, i, PROFILE_TABS.length, "horizontal")
                if (next === null) return
                e.preventDefault()
                onTabChange(PROFILE_TABS[next]!.id)
                tabRefs.current[next]?.focus()
              }}
            >
              {t.label}
              <span className="profile-tab-n">{tabCount(user, t.id)}</span>
            </button>
          )
        })}
      </div>

      <div
        className="profile-list"
        role="tabpanel"
        id={`${tabsId}-panel`}
        aria-labelledby={`${tabsId}-tab-${tab}`}
      >
        <UserActivity userId={user.id} tab={tab} />
      </div>
    </>
  )
}

export function UserDetail({ userId }: { userId: string }) {
  const userQuery = useUser(userId)
  const nav = useNav()
  const mutations = useUserAccountMutations()
  const [tab, setTab] = React.useState<ProfileTab>("reports")

  if (userQuery.isLoading) return <LoadingState label="Loading account..." />
  if (userQuery.isError && !isNotFound(userQuery.error)) {
    return <ErrorState error={userQuery.error} onRetry={() => userQuery.refetch()} />
  }
  const user = userQuery.data
  if (!user) {
    return (
      <EmptyState
        title="User not found"
        sub="No account has this ID."
        icon={<Icons.Users size={20} />}
      />
    )
  }

  return (
    <div className="user-detail">
      <UserDetailHeader user={user} />
      <UserProfileMeta user={user} />
      <UserOrganizations user={user} nav={nav} />
      <UserActivityTabs user={user} tab={tab} onTabChange={setTab} />
      <UserActionsBar user={user} mutations={mutations} />
    </div>
  )
}

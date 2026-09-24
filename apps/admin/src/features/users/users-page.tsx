"use client"

import * as React from "react"
import {
  REPORT_CATEGORY_LABELS,
  RISK_LABELS,
  USER_STATUS_LABELS,
  avatarColor,
  monogram,
  type AdminUserDTO,
  type AdminUserListItemDTO,
  type AdminUserListQuery,
  type CleanupMemberRole,
  type UserEventItemDTO,
  type UserMessageItemDTO,
  type UserReportItemDTO,
  type UserStatus,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { categoryPinSrc } from "@/lib/category"
import { reportStatusView } from "@/lib/report-status"
import { confirmDialog, promptDialog } from "@/components/shared/dialog"
import { useDebounced } from "@/hooks/use-debounced"
import {
  useFlagUser,
  useRemoveUserMessage,
  useSetUserReportVerified,
  useSetUserStatus,
  useUser,
  useUserEvents,
  useUserListInfinite,
  useUserMessages,
  useUserReports,
} from "@/features/users/use-users"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { ORG_ROLE_LABEL, ORG_ROLE_PILL, menuFocusIndex } from "@/features/orgs/org-members"
import {
  userOrganizationFocus,
  userOrganizationsView,
  type UserOrganization,
} from "@/features/users/user-organizations"
import { getUserMessageDestination } from "./profile-activity-navigation"
import { userSearchTerm } from "./user-search"
import { isNotFound } from "@/lib/api"
import { useNav, useToast, type PageId } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

type NavFn = ReturnType<typeof useNav>


const STATUS_VIEW: Record<UserStatus, { cls: string; label: string }> = {
  active: { cls: "status-ok", label: USER_STATUS_LABELS.active },
  suspended: { cls: "status-flag", label: USER_STATUS_LABELS.suspended },
  review: { cls: "status-progress", label: USER_STATUS_LABELS.review },
  banned: { cls: "status-flag", label: USER_STATUS_LABELS.banned },
}

// The client passes a status newer than this build through unvalidated; show it raw rather than crash.
function userStatusView(status: UserStatus): { cls: string; label: string } {
  return STATUS_VIEW[status] ?? { cls: "priority-low", label: status }
}

const SOURCE_LABEL: Record<NonNullable<UserMessageItemDTO["source"]> | "group", string> = {
  chat: "Cleanup chat",
  group: "Group chat",
  dm: "Direct message",
  report: "Report comment",
}

function UserAvatar({
  user,
  large = false,
}: {
  user: Pick<AdminUserListItemDTO, "id" | "name"> & {
    avatar?: AdminUserListItemDTO["avatar"]
    avatarUrl?: string | null
  }
  large?: boolean
}) {
  const color = user.avatar?.[0] ?? avatarColor(user.id)
  const cls = `user-av${large ? " lg" : ""}`
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={cls} src={user.avatarUrl} alt="" />
    )
  }
  return (
    <span className={cls} style={{ background: color }}>
      {monogram(user.name)}
    </span>
  )
}

function isMissing(v: string | null | undefined): boolean {
  const t = (v ?? "").trim()
  return t === "" || t === "-"
}

function joinDate(v: string): string {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function ProfileReportRow({ r, nav }: { r: UserReportItemDTO; nav: NavFn }) {
  const open = () => nav("reports", r.id)
  return (
    <div
      className="prow row-link"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (!isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        open()
      }}
    >
      <span className="prow-pin" title={REPORT_CATEGORY_LABELS[r.category]}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={categoryPinSrc(r.category)} alt="" />
      </span>
      <div className="prow-body">
        <div className="prow-title">{r.title}</div>
        <div className="prow-meta">
          {r.place} · <span className="mono">{r.id}</span>
        </div>
      </div>
      <span className={`pill ${reportStatusView(r.status).cls} tight`}>
        {reportStatusView(r.status).label}
      </span>
      <span className="prow-age">{r.age}</span>
    </div>
  )
}

const EVENT_ROLE_VIEW: Record<CleanupMemberRole, { verb: string; pill: string | null }> = {
  organizer: { verb: "Organized", pill: "Organizer" },
  cohost: { verb: "Co-hosted", pill: "Co-host" },
  coordinator: { verb: "Coordinated", pill: "Coordinator" },
  staff: { verb: "Staffed", pill: "Staff" },
  member: { verb: "Joined", pill: null },
}

function ProfileEventRow({ e, nav }: { e: UserEventItemDTO; nav: NavFn }) {
  const role = EVENT_ROLE_VIEW[e.role] ?? EVENT_ROLE_VIEW.member
  const open = () => nav("events", e.id)
  return (
    <div
      className="prow row-link"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(ev) => {
        if (!isKeyboardActivationKey(ev.key)) return
        ev.preventDefault()
        open()
      }}
    >
      <span className="prow-ico hue-moss">
        <Icons.Calendar size={14} />
      </span>
      <div className="prow-body">
        <div className="prow-title">
          {role.verb} the {e.title}
        </div>
        <div className="prow-meta">
          {!isMissing(e.place) && (
            <>
              {e.place}
              <span className="sep"> · </span>
            </>
          )}
          {e.attendees} {e.attendees === 1 ? "neighbor" : "neighbors"} joined
        </div>
      </div>
      {role.pill && <span className="pill status-progress tight">{role.pill}</span>}
      <span className="prow-age">{e.when}</span>
    </div>
  )
}

function ProfileMessageRow({
  m,
  onRemove,
  removing,
  nav,
}: {
  m: UserMessageItemDTO
  onRemove: (m: UserMessageItemDTO) => void
  removing: boolean
  nav: NavFn
}) {
  const removed = !!m.deletedAt
  const linkTo: { page: PageId; id: string } | null = getUserMessageDestination(m)
  const open = linkTo ? () => nav(linkTo.page, linkTo.id) : undefined
  const content = (
    <>
      <span className="prow-ico hue-sky">
        {removed ? <Icons.Trash size={14} /> : <Icons.MessageSquare size={14} />}
      </span>
      <span className="prow-body">
        <span className="prow-title">
          {removed && <span className="pill status-flag tight">Removed</span>} {m.text}
        </span>
        <span className="prow-meta">
          {m.source && <span className="pill priority-low tight">{SOURCE_LABEL[m.source]}</span>} in{" "}
          {m.thread}
        </span>
      </span>
      <span className="prow-age">{m.when}</span>
    </>
  )
  return (
    <div className={`prow ${removed ? "removed" : ""}`}>
      {open ? (
        <button type="button" className="prow-main row-link" onClick={open}>
          {content}
        </button>
      ) : (
        <div className="prow-main">{content}</div>
      )}
      {!removed && (
        <button
          className="btn sm danger"
          disabled={removing}
          onClick={() => onRemove(m)}
          title="Remove this message (soft-delete; operators still see it as removed)"
        >
          <Icons.Trash size={11} /> Remove
        </button>
      )}
    </div>
  )
}

type TabId = "reports" | "events" | "messages"

interface SubListQuery {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
}

function LoadMore({ query }: { query: SubListQuery }) {
  if (!query.hasNextPage) return null
  return (
    <button
      type="button"
      className="btn load-more"
      disabled={query.isFetchingNextPage}
      onClick={() => void query.fetchNextPage()}
    >
      {query.isFetchingNextPage ? "Loading…" : "Load more"}
    </button>
  )
}

function UserActivity({ userId, tab }: { userId: string; tab: TabId }) {
  const nav = useNav()
  const reports = useUserReports(tab === "reports" ? userId : null)
  const events = useUserEvents(tab === "events" ? userId : null)
  const messages = useUserMessages(tab === "messages" ? userId : null)
  const removeMsg = useRemoveUserMessage()
  const toast = useToast()

  const onRemoveMessage = async (m: UserMessageItemDTO) => {
    const reason = await promptDialog({ title: "Remove message", label: "Reason (optional)" })
    if (reason === null) return
    removeMsg.mutate(
      { id: userId, messageId: m.id, ...(reason ? { reason } : {}) },
      { onSuccess: () => toast("Message removed") },
    )
  }

  if (tab === "reports") {
    if (reports.isLoading) return <LoadingState label="Loading reports..." />
    if (reports.isError) return <ErrorState error={reports.error} onRetry={() => reports.refetch()} />
    const items = reports.data?.pages.flatMap((p) => p.items) ?? []
    if (!items.length)
      return (
        <EmptyState
          title="No reports yet"
          sub="This neighbor hasn't filed any reports."
          icon={<Icons.Layers size={20} />}
        />
      )
    return (
      <>
        {items.map((r) => (
          <ProfileReportRow key={r.id} r={r} nav={nav} />
        ))}
        <LoadMore query={reports} />
      </>
    )
  }

  if (tab === "events") {
    if (events.isLoading) return <LoadingState label="Loading cleanups..." />
    if (events.isError) return <ErrorState error={events.error} onRetry={() => events.refetch()} />
    const items = events.data?.pages.flatMap((p) => p.items) ?? []
    if (!items.length)
      return (
        <EmptyState
          title="No cleanup events yet"
          sub="This neighbor hasn't joined any cleanups."
          icon={<Icons.Calendar size={20} />}
        />
      )
    return (
      <>
        {items.map((e) => (
          <ProfileEventRow key={e.id} e={e} nav={nav} />
        ))}
        <LoadMore query={events} />
      </>
    )
  }

  if (messages.isLoading) return <LoadingState label="Loading messages..." />
  if (messages.isError) return <ErrorState error={messages.error} onRetry={() => messages.refetch()} />
  const items = messages.data?.pages.flatMap((p) => p.items) ?? []
  if (!items.length)
    return (
      <EmptyState
        title="No messages yet"
        sub="This neighbor hasn't sent any messages."
        icon={<Icons.MessageSquare size={20} />}
      />
    )
  return (
    <>
      {items.map((m) => (
        <ProfileMessageRow
          key={m.id}
          m={m}
          onRemove={onRemoveMessage}
          removing={removeMsg.isPending}
          nav={nav}
        />
      ))}
      <LoadMore query={messages} />
    </>
  )
}

function UserOrganizations({ user, nav }: { user: AdminUserDTO; nav: NavFn }) {
  const { reported, items } = userOrganizationsView(user.organizations)
  if (!reported) return null
  return (
    <div className="sub user-orgs">
      <div className="sub-head">Organizations</div>
      <div className="sub-body">
        {items.length === 0 ? (
          <span className="muted">No organizations</span>
        ) : (
          items.map((org) => <UserOrganizationRow key={org.id} org={org} nav={nav} />)
        )}
      </div>
    </div>
  )
}

function UserOrganizationRow({ org, nav }: { org: UserOrganization; nav: NavFn }) {
  const open = () => nav("orgs", userOrganizationFocus(org))
  return (
    <div className="qrow static user-org-row">
      <span className="org-logo hue-sky">{monogram(org.name)}</span>
      <div className="body">
        <div className="top">
          <span
            className="title lnk-inline"
            role="button"
            tabIndex={0}
            title="Open organization"
            onClick={open}
            onKeyDown={(e) => {
              if (!isKeyboardActivationKey(e.key)) return
              e.preventDefault()
              open()
            }}
          >
            {org.name}
          </span>
          <span className="ident mono">/{org.slug}</span>
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${ORG_ROLE_PILL[org.role] ?? "priority-low"} tight`}>
          {ORG_ROLE_LABEL[org.role] ?? org.role}
        </span>
      </div>
    </div>
  )
}

function tabCount(user: AdminUserDTO, id: TabId): number {
  if (id === "reports") return user.reports
  if (id === "events") return user.cleanups
  return user.messages
}

function UserDetail({ userId }: { userId: string }) {
  const q = useUser(userId)
  const toast = useToast()
  const nav = useNav()

  const flag = useFlagUser()
  const setStatus = useSetUserStatus()
  const setReportVerified = useSetUserReportVerified()

  const [tab, setTab] = React.useState<TabId>("reports")
  const tabsId = React.useId()
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  if (q.isLoading) return <LoadingState label="Loading account..." />
  if (q.isError && !isNotFound(q.error)) {
    return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  }
  const user = q.data
  if (!user) {
    return (
      <EmptyState
        title="User not found"
        sub="No account has this ID."
        icon={<Icons.Users size={20} />}
      />
    )
  }

  const deleted = !!user.deletedAt
  const statusView = userStatusView(user.status)

  const tabs: { id: TabId; label: string }[] = [
    { id: "reports", label: "Reports" },
    { id: "events", label: "Events" },
    { id: "messages", label: "Messages" },
  ]

  const onFlag = () => {
    flag.mutate(
      { id: user.id },
      {
        onSuccess: () =>
          toast(user.flagged ? `${user.name} · flag cleared` : `${user.name} · account flagged`),
      },
    )
  }

  const onBan = async () => {
    if (user.status === "banned") return
    const ok = await confirmDialog({
      title: "Ban user",
      body: `Ban ${user.name}? This revokes all of their sessions.`,
      danger: true,
      confirmLabel: "Ban",
    })
    if (!ok) return
    setStatus.mutate(
      { id: user.id, status: "banned" },
      { onSuccess: () => toast(`${user.name} · account banned`) },
    )
  }

  const onSuspend = async () => {
    if (user.status !== "active") return
    const ok = await confirmDialog({
      title: "Suspend user",
      body: `Suspend ${user.name}? They keep their account but can't post.`,
      danger: true,
      confirmLabel: "Suspend",
    })
    if (!ok) return
    setStatus.mutate(
      { id: user.id, status: "suspended" },
      { onSuccess: () => toast(`${user.name} · account suspended`) },
    )
  }

  const onReactivate = async () => {
    if (user.status !== "banned" && user.status !== "suspended") return
    const verb = user.status === "banned" ? "Un-ban" : "Reactivate"
    const ok = await confirmDialog({
      title: `${verb} user`,
      body: `${verb} ${user.name}? This restores their access.`,
      confirmLabel: verb,
    })
    if (!ok) return
    setStatus.mutate(
      { id: user.id, status: "active" },
      { onSuccess: () => toast(`${user.name} · account reactivated`) },
    )
  }

  const onCopyId = () => {
    const copyFailed = () => toast("Couldn't copy. Select the ID manually.", "error")
    // The Clipboard API exists only in a secure context; without it nothing is copied.
    if (!navigator.clipboard) {
      copyFailed()
      return
    }
    navigator.clipboard.writeText(user.id).then(() => toast("User ID copied"), copyFailed)
  }

  const isReportVerified = !!user.reportVerified
  const onToggleReportVerified = () => {
    const next = !isReportVerified
    setReportVerified.mutate(
      { id: user.id, value: next },
      {
        onSuccess: () =>
          toast(
            next
              ? `${user.name} · report-verified`
              : `${user.name} · report-verification removed`,
          ),
      },
    )
  }

  return (
    <div className="user-detail">
      <div className="user-detail-head">
        <UserAvatar user={user} large />

        <div className="udh-text">
          <h2>{user.name}</h2>
          <div className="udh-sub">
            <span className="mono">{isMissing(user.handle) ? "—" : user.handle}</span>
            {!isMissing(user.city) && (
              <>
                <span className="sep">·</span>
                <span>{user.city}</span>
              </>
            )}
          </div>
        </div>
        <div className="udh-badges">
          {deleted && (
            <span className="pill status-flag tight" title="This account was self-deleted (tombstoned)">
              <Icons.Trash size={11} /> Deleted
            </span>
          )}
          {user.flagged && (
            <span className="pill status-flag">
              <Icons.Flag size={11} /> Flagged
            </span>
          )}
          {isReportVerified && (
            <span
              className="pill status-new"
              title="Report-verified — this reporter's reports auto-forward to their jurisdiction"
            >
              <Icons.Check size={11} /> Report-verified
            </span>
          )}
          <span className={`pill ${statusView.cls}`}>{statusView.label}</span>
        </div>
      </div>

      <div className="profile-meta">
        <span className="pm-item">
          <Icons.Activity size={13} /> Active {isMissing(user.lastActive) ? "never" : user.lastActive}
        </span>
        <span className="pm-item">
          <Icons.Calendar size={13} /> Joined{" "}
          {isMissing(user.joined) ? "unknown" : joinDate(user.joined)}
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
          title="Copy the raw account UUID (admin/DB only — not shown to neighbors)"
        >
          <Icons.Hash size={13} /> <span className="mono">{user.id}</span>
          <Icons.Copy size={12} />
        </button>
      </div>

      <UserOrganizations user={user} nav={nav} />

      <div className="profile-tabs" role="tablist" aria-label="Activity">
        {tabs.map((t, i) => {
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
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => {
                const next = menuFocusIndex(e.key, i, tabs.length, "horizontal")
                if (next === null) return
                e.preventDefault()
                setTab(tabs[next]!.id)
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

      <div className="user-actions">
        {deleted && (
          <span className="rep-actions-label">
            Account self-deleted — status actions disabled. Per-content removal stays available.
          </span>
        )}
        <div className="spacer" />
        <button
          className={`btn ${user.flagged ? "flag-on" : ""}`}
          disabled={flag.isPending || deleted}
          onClick={onFlag}
        >
          <Icons.Flag size={13} /> {user.flagged ? "Flagged" : "Flag account"}
        </button>
        <button
          className="btn"
          disabled={setReportVerified.isPending || deleted}
          onClick={onToggleReportVerified}
          title={
            isReportVerified
              ? "Remove the report-verified mark (their reports stop auto-forwarding)"
              : "Mark report-verified (their reports auto-forward to their jurisdiction)"
          }
        >
          <Icons.Check size={13} /> {isReportVerified ? "Unverify report" : "Verify report"}
        </button>
        {!deleted && (user.status === "banned" || user.status === "suspended") && (
          <button className="btn" disabled={setStatus.isPending} onClick={onReactivate}>
            <Icons.Check size={13} /> {user.status === "banned" ? "Un-ban" : "Reactivate"}
          </button>
        )}
        {!deleted && user.status === "active" && (
          <button className="btn" disabled={setStatus.isPending} onClick={onSuspend}>
            <Icons.Lock size={13} /> Suspend
          </button>
        )}
        <button
          className="btn danger"
          disabled={setStatus.isPending || user.status === "banned" || deleted}
          onClick={onBan}
        >
          <Icons.Trash size={13} /> {user.status === "banned" ? "Banned" : "Ban account"}
        </button>
      </div>
    </div>
  )
}

function UserRow({
  user,
  selected,
  onClick,
}: {
  user: AdminUserListItemDTO
  selected: boolean
  onClick: () => void
}) {
  const statusView = userStatusView(user.status)
  return (
    <div
      className={`qrow ${selected ? "selected" : ""}`}
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
      <UserAvatar user={user} />
      <div className="body">
        <div className="top">
          <span className="title">{user.name}</span>
          {user.flagged && (
            <span className="rep-flag-dot" role="img" aria-label="Flagged" title="Flagged">
              <Icons.Flag size={10} />
            </span>
          )}
          <span className="ident">{isMissing(user.handle) ? "—" : user.handle}</span>
        </div>
        <div className="sub">
          {!isMissing(user.city) && (
            <>
              <span>{user.city}</span>
              <span className="sep">·</span>
            </>
          )}
          <span className="strong">
            {user.reports} {user.reports === 1 ? "report" : "reports"}
          </span>
          <span className="sep">·</span>
          <span>
            {user.cleanups} {user.cleanups === 1 ? "cleanup" : "cleanups"}
          </span>
        </div>
      </div>
      <div className="trailing">
        {user.deletedAt && (
          <span className="pill status-flag tight" title="Self-deleted (tombstoned) account">
            Deleted
          </span>
        )}
        <span className={`pill ${statusView.cls} tight`}>{statusView.label}</span>
      </div>
    </div>
  )
}

type UserFilter = "all" | NonNullable<AdminUserListQuery["filter"]>

export function UsersPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<UserFilter>("all")
  const [query, setQuery] = React.useState("")
  const debouncedQuery = useDebounced(query, 250)
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const searchTerm = userSearchTerm(debouncedQuery)
  const listParams: AdminUserListQuery = {
    ...(filter === "all" ? {} : { filter }),
    ...(searchTerm ? { q: searchTerm } : {}),
  }
  const listKey = JSON.stringify(listParams)
  const listQuery = useUserListInfinite(listParams)
  const items = React.useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  )

  const counts = listQuery.data?.pages[0]?.counts

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  // The selection rules every master-detail page follows: only the first load picks on the operator's
  // behalf. A pick that a filter or search leaves out stays open, because the detail reads it by id. A
  // pick that drops out of the same list after a refetch (a ban under the Active chip, say) clears, so
  // the pane never jumps to another account's Ban button. Each decision waits for data fetched for the
  // current params: a cached page that is refetching may predate the change that matters.
  const [autoPick, setAutoPick] = React.useState(focusId === null)
  const seenIn = React.useRef<{ id: string; list: string } | null>(null)
  React.useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isFetching) return
    if (selId === null) {
      if (autoPick && items.length) setSelId(items[0]!.id)
      return
    }
    setAutoPick(false)
    if (items.some((x) => x.id === selId)) seenIn.current = { id: selId, list: listKey }
    else if (seenIn.current?.id === selId && seenIn.current.list === listKey) setSelId(null)
  }, [listQuery.isSuccess, listQuery.isFetching, items, selId, listKey, autoPick])

  return (
    <>
      <PageHead
        title="Users"
        subtitle={
          <span>
            Every neighbor on civfix and what they&apos;ve contributed — the reports they&apos;ve
            filed, cleanups they&apos;ve joined, and messages they&apos;ve sent.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={[
            { value: "all", label: "All", count: counts?.all },
            { value: "active", label: "Active", count: counts?.active },
            { value: "suspended", label: "Suspended", count: counts?.suspended },
            { value: "flagged", label: "Flagged", count: counts?.flagged },
            { value: "banned", label: "Banned", count: counts?.banned },
            { value: "deleted", label: "Deleted", count: counts?.deleted },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as UserFilter)}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            aria-label="Search accounts"
            placeholder="Search name, handle, city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Accounts</h3>
            <div className="spacer" />
            <span className="meta">{items.length}</span>
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading accounts..." />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                title="Nothing matches"
                sub="Try a different filter or search."
                icon={<Icons.Search size={20} />}
              />
            ) : (
              <>
                {items.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    selected={selId === u.id}
                    onClick={() => setSelId(u.id)}
                  />
                ))}
                {listQuery.hasNextPage && (
                  <button
                    type="button"
                    className="btn"
                    style={{ width: "calc(100% - 20px)", margin: "8px 10px" }}
                    disabled={listQuery.isFetchingNextPage}
                    onClick={() => listQuery.fetchNextPage()}
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
            <UserDetail key={selId} userId={selId} />
          ) : (
            <EmptyState
              title="No user selected"
              sub="Pick an account from the list."
              icon={<Icons.Users size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

"use client"

import * as React from "react"
import {
  REPORT_CATEGORY_LABELS,
  type AdminReportStatus,
  type AdminUserDTO,
  type AdminUserListItemDTO,
  type ReportCategory,
  type UserEventItemDTO,
  type UserMessageItemDTO,
  type UserReportItemDTO,
  type UserStatus,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import {
  useFlagUser,
  useSetUserStatus,
  useUser,
  useUserEvents,
  useUserList,
  useUserMessages,
  useUserReports,
} from "@/features/users/use-users"
import { useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Users (ported from pages-users.jsx, enumeration 2.F). Master-detail: the account list on the left
 * (filter chips All / Active / Suspended / Flagged + counts, search name/handle/city) and the full
 * account detail on the right (head avatar/name/handle/city + Flagged/status badges, profile meta, the
 * Reports/Events/Messages tabs each with a count, and the action bar: flag toggle + ban). All wired to
 * the typed admin client.
 *
 * Difference from the prototype: the three tabs render REAL data from getUserReports / getUserEvents /
 * getUserMessages (the prototype synthesized rows client-side). Each tab has its own loading / error /
 * empty state. The action bar matches the design (Flag + Ban only); role/gov provisioning flows through
 * the government claims queue, not the user detail.
 */

/**
 * Visual treatment per civfix account status (pill class + design label). The pill renders `label`
 * (the design's Active / Suspended / In review / Banned).
 */
const STATUS_VIEW: Record<UserStatus, { cls: string; label: string }> = {
  active: { cls: "status-ok", label: "Active" },
  suspended: { cls: "status-flag", label: "Suspended" },
  review: { cls: "status-progress", label: "In review" },
  banned: { cls: "status-flag", label: "Banned" },
}

/**
 * Visual treatment per civfix report status for the Reports tab rows (pill class + design label).
 * Mirrors the Reports page: each civfix value maps to the design's Submitted / In progress /
 * Completed bucket, plus rejected → "Removed".
 */
const REPORT_STATUS_VIEW: Record<AdminReportStatus, { cls: string; label: string }> = {
  submitted: { cls: "status-new", label: "Submitted" },
  held: { cls: "status-progress", label: "In progress" },
  published: { cls: "status-ok", label: "Completed" },
  acknowledged: { cls: "status-progress", label: "In progress" },
  in_progress: { cls: "status-progress", label: "In progress" },
  resolved: { cls: "status-ok", label: "Completed" },
  rejected: { cls: "status-flag", label: "Removed" },
}

function catPinSrc(category: ReportCategory): string | null {
  if (category === "other") return null
  return `/ds/pin-${category}.svg`
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function ProfileReportRow({ r }: { r: UserReportItemDTO }) {
  const pin = catPinSrc(r.category)
  return (
    <div className="prow">
      <span className="prow-pin" title={REPORT_CATEGORY_LABELS[r.category]}>
        {pin ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pin} alt="" />
        ) : (
          <Icons.Layers size={16} />
        )}
      </span>
      <div className="prow-body">
        <div className="prow-title">{r.title}</div>
        <div className="prow-meta">
          {r.place} · <span className="mono">{r.id}</span>
        </div>
      </div>
      <span className={`pill ${REPORT_STATUS_VIEW[r.status].cls} tight`}>
        {REPORT_STATUS_VIEW[r.status].label}
      </span>
      <span className="prow-age">{r.age}</span>
    </div>
  )
}

function ProfileEventRow({ e }: { e: UserEventItemDTO }) {
  const organized = e.role === "organizer"
  return (
    <div className="prow">
      <span className="prow-ico hue-moss">
        <Icons.Calendar size={14} />
      </span>
      <div className="prow-body">
        <div className="prow-title">
          {organized ? "Organized" : "Joined"} the {e.title}
        </div>
        <div className="prow-meta">{e.attendees} neighbors attended</div>
      </div>
      {organized && <span className="pill status-progress tight">Organizer</span>}
      <span className="prow-age">{e.when}</span>
    </div>
  )
}

function ProfileMessageRow({ m }: { m: UserMessageItemDTO }) {
  return (
    <div className="prow">
      <span className="prow-ico hue-sky">
        <Icons.MessageSquare size={14} />
      </span>
      <div className="prow-body">
        <div className="prow-title">{m.text}</div>
        <div className="prow-meta">in {m.thread}</div>
      </div>
      <span className="prow-age">{m.when}</span>
    </div>
  )
}

type TabId = "reports" | "events" | "messages"

/** The Reports / Events / Messages tab content, each wired to its own sub-activity query. */
function UserActivity({ userId, tab }: { userId: string; tab: TabId }) {
  const reports = useUserReports(tab === "reports" ? userId : null)
  const events = useUserEvents(tab === "events" ? userId : null)
  const messages = useUserMessages(tab === "messages" ? userId : null)

  if (tab === "reports") {
    if (reports.isLoading) return <LoadingState label="Loading reports..." />
    if (reports.isError) return <ErrorState error={reports.error} onRetry={() => reports.refetch()} />
    const items = reports.data?.items ?? []
    if (!items.length) return <div className="profile-empty">No reports yet.</div>
    return (
      <>
        {items.map((r) => (
          <ProfileReportRow key={r.id} r={r} />
        ))}
      </>
    )
  }

  if (tab === "events") {
    if (events.isLoading) return <LoadingState label="Loading cleanups..." />
    if (events.isError) return <ErrorState error={events.error} onRetry={() => events.refetch()} />
    const items = events.data?.items ?? []
    if (!items.length) return <div className="profile-empty">No cleanup events yet.</div>
    return (
      <>
        {items.map((e) => (
          <ProfileEventRow key={e.id} e={e} />
        ))}
      </>
    )
  }

  if (messages.isLoading) return <LoadingState label="Loading messages..." />
  if (messages.isError) return <ErrorState error={messages.error} onRetry={() => messages.refetch()} />
  const items = messages.data?.items ?? []
  if (!items.length) return <div className="profile-empty">No messages yet.</div>
  return (
    <>
      {items.map((m) => (
        <ProfileMessageRow key={m.id} m={m} />
      ))}
    </>
  )
}

/** Tab counts come from the user's own counters (reports/cleanups); messages is not pre-counted. */
function tabCount(user: AdminUserDTO, id: TabId): number | null {
  if (id === "reports") return user.reports
  if (id === "events") return user.cleanups
  return null
}

function UserDetail({ userId }: { userId: string }) {
  const q = useUser(userId)
  const toast = useToast()

  const flag = useFlagUser()
  const setStatus = useSetUserStatus()

  const [tab, setTab] = React.useState<TabId>("reports")

  if (q.isLoading) return <LoadingState label="Loading account..." />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const user = q.data
  if (!user) {
    return (
      <EmptyState
        title="No user selected"
        sub="Pick an account from the list."
        icon={<Icons.Users size={20} />}
      />
    )
  }

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
          toast(user.flagged ? `${user.id} · flag cleared` : `${user.id} · account flagged`),
      },
    )
  }

  const onBan = () => {
    if (user.status === "banned") return
    if (!window.confirm(`Ban ${user.name}? This revokes all of their sessions.`)) return
    setStatus.mutate(
      { id: user.id, status: "banned" },
      { onSuccess: () => toast(`${user.id} · Account banned`) },
    )
  }

  return (
    <div className="user-detail">
      <div className="user-detail-head">
        <span
          className="user-av lg"
          style={{ background: "linear-gradient(135deg, var(--sky), var(--moss))" }}
        >
          {initials(user.name)}
        </span>
        <div className="udh-text">
          <h2>{user.name}</h2>
          <div className="udh-sub">
            <span className="mono">{user.handle}</span>
            <span className="sep">·</span>
            <span>{user.city}</span>
          </div>
        </div>
        <div className="udh-badges">
          {user.flagged && (
            <span className="pill status-flag">
              <Icons.Flag size={11} /> Flagged
            </span>
          )}
          <span className={`pill ${STATUS_VIEW[user.status].cls}`}>
            {STATUS_VIEW[user.status].label}
          </span>
        </div>
      </div>

      <div className="profile-meta">
        <span className="pm-item">
          <Icons.Activity size={13} /> Active {user.lastActive}
        </span>
        <span className="pm-item">
          <Icons.Calendar size={13} /> Joined {user.joined}
        </span>
        <span className="pm-item">
          <Icons.Pin size={13} /> {user.city}
        </span>
      </div>

      <div className="profile-tabs">
        {tabs.map((t) => {
          const n = tabCount(user, t.id)
          return (
            <button
              key={t.id}
              className={`profile-tab ${tab === t.id ? "on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {n !== null && <span className="profile-tab-n">{n}</span>}
            </button>
          )
        })}
      </div>

      <div className="profile-list">
        <UserActivity userId={user.id} tab={tab} />
      </div>

      <div className="user-actions">
        <div className="spacer" />
        <button
          className={`btn ${user.flagged ? "flag-on" : ""}`}
          disabled={flag.isPending}
          onClick={onFlag}
        >
          <Icons.Flag size={13} /> {user.flagged ? "Flagged" : "Flag account"}
        </button>
        <button
          className="btn danger"
          disabled={setStatus.isPending || user.status === "banned"}
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
  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={onClick}>
      <span
        className="user-av"
        style={{ background: "linear-gradient(135deg, var(--sky), var(--moss))" }}
      >
        {initials(user.name)}
      </span>
      <div className="body">
        <div className="top">
          <span className="title">{user.name}</span>
          {user.flagged && (
            <span className="rep-flag-dot" title="Flagged">
              <Icons.Flag size={10} />
            </span>
          )}
          <span className="ident">{user.handle}</span>
        </div>
        <div className="sub">
          <span>{user.city}</span>
          <span className="sep">·</span>
          <span className="strong">{user.reports} reports</span>
          <span className="sep">·</span>
          <span>{user.cleanups} cleanups</span>
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${STATUS_VIEW[user.status].cls} tight`}>
          {STATUS_VIEW[user.status].label}
        </span>
      </div>
    </div>
  )
}

export function UsersPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const listParams = {
    filter: filter === "all" ? undefined : (filter as "active" | "suspended" | "flagged"),
    q: query.trim() || undefined,
  }
  const listQuery = useUserList(listParams)
  const items = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data])

  // Unfiltered list for stable chip counts across filters. In the default "All" view with no search,
  // `listParams` serializes to the same query key as `{}` (filter/q both undefined), so this second
  // `useUserList({})` resolves against the SAME TanStack Query cache entry as `listQuery` — no extra
  // network round-trip or Zod parse on a plain Users mount; we just reuse the already-fetched `items`.
  // When a filter/search IS active it resolves separately so the chips keep showing the UNFILTERED totals
  // (stable across filters) rather than collapsing to the narrowed page's contents. Both queries are
  // keyset-paginated (server-side default page size, max 100), so these counts cap at the first page; a
  // fully accurate total would need a server-side per-status counts block (a contract addition).
  const isUnfiltered = !listParams.filter && !listParams.q
  const allQuery = useUserList({})
  const allItems = React.useMemo(
    () => (isUnfiltered ? items : (allQuery.data?.items ?? [])),
    [isUnfiltered, items, allQuery.data],
  )
  const counts = {
    all: allItems.length,
    active: allItems.filter((u) => u.status === "active").length,
    suspended: allItems.filter((u) => u.status !== "active").length,
    flagged: allItems.filter((u) => u.flagged).length,
  }

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
            { value: "all", label: "All", count: counts.all },
            { value: "active", label: "Active", count: counts.active },
            { value: "suspended", label: "Suspended", count: counts.suspended },
            { value: "flagged", label: "Flagged", count: counts.flagged },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
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
              items.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  selected={selId === u.id}
                  onClick={() => setSelId(u.id)}
                />
              ))
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

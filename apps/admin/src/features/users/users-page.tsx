"use client"

import * as React from "react"
import {
  REPORT_CATEGORY_LABELS,
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
import { reportStatusView } from "@/lib/report-status"
import {
  useFlagUser,
  useRemoveUserMessage,
  useSetUserStatus,
  useSetUserVerified,
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
 * Reports/Events/Messages tabs each with a count, and the action bar: flag toggle + status controls
 * (Suspend when active, Un-ban/Reactivate when suspended/banned, Ban)). All wired to the typed admin
 * client.
 *
 * Difference from the prototype: the three tabs render REAL data from getUserReports / getUserEvents /
 * getUserMessages (the prototype synthesized rows client-side). Each tab has its own loading / error /
 * empty state. The action bar extends the design's flag/ban with reversible Suspend / Reactivate.
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

/** The server returns a "-" sentinel for an absent timestamp; treat it (and empty) as missing. */
function isMissing(v: string | null | undefined): boolean {
  const t = (v ?? "").trim()
  return t === "" || t === "-"
}

/** Best-effort date-only rendering of a join timestamp; falls back to the raw string if unparseable. */
function joinDate(v: string): string {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
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
      <span className={`pill ${reportStatusView(r.status).cls} tight`}>
        {reportStatusView(r.status).label}
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
        <div className="prow-meta">
          {!isMissing(e.place) && (
            <>
              {e.place}
              <span className="sep"> · </span>
            </>
          )}
          {e.attendees} neighbors joined
        </div>
      </div>
      {organized && <span className="pill status-progress tight">Organizer</span>}
      <span className="prow-age">{e.when}</span>
    </div>
  )
}

/**
 * One row in the user's Messages tab. The admin sees EVERY message — including ones the user themselves
 * deleted (a `deletedAt` tombstone), rendered as "[deleted by user]" while STILL showing the original
 * text (operators keep full visibility). A per-message Remove action (operator soft-delete) is offered on
 * messages the user has NOT already deleted, mirroring the discussion-message Remove pattern.
 */
function ProfileMessageRow({
  m,
  onRemove,
  removing,
}: {
  m: UserMessageItemDTO
  onRemove: (m: UserMessageItemDTO) => void
  removing: boolean
}) {
  const userDeleted = !!m.deletedAt
  return (
    <div className={`prow ${userDeleted ? "removed" : ""}`}>
      <span className="prow-ico hue-sky">
        {userDeleted ? <Icons.Trash size={14} /> : <Icons.MessageSquare size={14} />}
      </span>
      <div className="prow-body">
        <div className="prow-title">
          {userDeleted && <span className="pill status-flag tight">[deleted by user]</span>} {m.text}
        </div>
        <div className="prow-meta">in {m.thread}</div>
      </div>
      <span className="prow-age">{m.when}</span>
      {/* Operator remove is offered only on a message the user hasn't already deleted. */}
      {!userDeleted && (
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

/** The Reports / Events / Messages tab content, each wired to its own sub-activity query. */
function UserActivity({ userId, tab }: { userId: string; tab: TabId }) {
  const reports = useUserReports(tab === "reports" ? userId : null)
  const events = useUserEvents(tab === "events" ? userId : null)
  const messages = useUserMessages(tab === "messages" ? userId : null)
  const removeMsg = useRemoveUserMessage()
  const toast = useToast()

  const onRemoveMessage = (m: UserMessageItemDTO) => {
    // Optional audited removal reason (mirrors the discussion/moderation remove-action shape).
    const reason = typeof window !== "undefined" ? window.prompt("Reason for removal (optional):") : null
    // A cancelled prompt returns null — treat it as "abort", an empty string as "no reason given".
    if (reason === null && typeof window !== "undefined") return
    removeMsg.mutate(
      { id: userId, messageId: m.id, ...(reason ? { reason } : {}) },
      { onSuccess: () => toast("Message removed") },
    )
  }

  if (tab === "reports") {
    if (reports.isLoading) return <LoadingState label="Loading reports..." />
    if (reports.isError) return <ErrorState error={reports.error} onRetry={() => reports.refetch()} />
    const items = reports.data?.items ?? []
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
          <ProfileReportRow key={r.id} r={r} />
        ))}
      </>
    )
  }

  if (tab === "events") {
    if (events.isLoading) return <LoadingState label="Loading cleanups..." />
    if (events.isError) return <ErrorState error={events.error} onRetry={() => events.refetch()} />
    const items = events.data?.items ?? []
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
          <ProfileEventRow key={e.id} e={e} />
        ))}
      </>
    )
  }

  if (messages.isLoading) return <LoadingState label="Loading messages..." />
  if (messages.isError) return <ErrorState error={messages.error} onRetry={() => messages.refetch()} />
  const items = messages.data?.items ?? []
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
        />
      ))}
    </>
  )
}

/** Tab counts come from the user's own counters (reports / cleanups / messages), all on the detail DTO. */
function tabCount(user: AdminUserDTO, id: TabId): number {
  if (id === "reports") return user.reports
  if (id === "events") return user.cleanups
  return user.messages
}

function UserDetail({ userId }: { userId: string }) {
  const q = useUser(userId)
  const toast = useToast()

  const flag = useFlagUser()
  const setStatus = useSetUserStatus()
  const setVerified = useSetUserVerified()

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

  // A self-deleted (tombstoned) account: the admin still sees the REAL identity + full activity (the
  // public DTOs render "Deleted User"; admin keeps the truth). Account-level status actions are disabled
  // (there is no live session/account to suspend or ban), but per-content removal stays available.
  const deleted = !!user.deletedAt

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

  const onBan = () => {
    if (user.status === "banned") return
    if (!window.confirm(`Ban ${user.name}? This revokes all of their sessions.`)) return
    setStatus.mutate(
      { id: user.id, status: "banned" },
      { onSuccess: () => toast(`${user.name} · account banned`) },
    )
  }

  const onSuspend = () => {
    if (user.status !== "active") return
    if (!window.confirm(`Suspend ${user.name}? They keep their account but can't post.`)) return
    setStatus.mutate(
      { id: user.id, status: "suspended" },
      { onSuccess: () => toast(`${user.name} · account suspended`) },
    )
  }

  const onReactivate = () => {
    if (user.status !== "banned" && user.status !== "suspended") return
    const verb = user.status === "banned" ? "Un-ban" : "Reactivate"
    if (!window.confirm(`${verb} ${user.name}? This restores their access.`)) return
    setStatus.mutate(
      { id: user.id, status: "active" },
      { onSuccess: () => toast(`${user.name} · account reactivated`) },
    )
  }

  // Verified-neighbor toggle: operators set this directly after a verification call (there is no
  // application queue). True = mark verified; false = clear the verified mark.
  const isVerified = user.verificationStatus === "verified"

  // The raw account UUID is operator/DB-only (never rendered to the public, where the @handle is the
  // identity). Surface it here, copyable, so operators can cross-reference the DB / logs / API.
  const onCopyId = () => {
    const id = user.id
    void Promise.resolve(navigator?.clipboard?.writeText(id))
      .then(() => toast("User ID copied"))
      .catch(() => toast("Couldn't copy — select the ID manually"))
  }

  const onToggleVerified = () => {
    const next = !isVerified
    setVerified.mutate(
      { id: user.id, verified: next },
      {
        onSuccess: () =>
          toast(next ? `${user.name} · verified` : `${user.name} · verification removed`),
      },
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
          {isVerified && (
            <span className="pill status-ok" title="Verified neighbor">
              <Icons.Shield size={11} /> Verified neighbor
            </span>
          )}
          <span className={`pill ${STATUS_VIEW[user.status].cls}`}>
            {STATUS_VIEW[user.status].label}
          </span>
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
        {/* Operator/DB-only raw account UUID (the public surfaces the @handle, never this). Copyable for
            cross-referencing the DB / logs / API; the value itself is also selectable mono text. */}
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
              <span className="profile-tab-n">{n}</span>
            </button>
          )
        })}
      </div>

      <div className="profile-list">
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
          className={`btn ${isVerified ? "" : "success"}`}
          disabled={setVerified.isPending || deleted}
          onClick={onToggleVerified}
          title={
            isVerified
              ? "Remove the verified-neighbor mark"
              : "Mark verified (after a verification call)"
          }
        >
          <Icons.Shield size={13} /> {isVerified ? "Unverify" : "Verify"}
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
          <span className="ident">{isMissing(user.handle) ? "—" : user.handle}</span>
        </div>
        <div className="sub">
          {!isMissing(user.city) && (
            <>
              <span>{user.city}</span>
              <span className="sep">·</span>
            </>
          )}
          <span className="strong">{user.reports} reports</span>
          <span className="sep">·</span>
          <span>{user.cleanups} cleanups</span>
        </div>
      </div>
      <div className="trailing">
        {user.deletedAt && (
          <span className="pill status-flag tight" title="Self-deleted (tombstoned) account">
            Deleted
          </span>
        )}
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

  // The "deleted" facet is CLIENT-SIDE: the frozen AdminUserListQuery filter union is
  // all|active|suspended|flagged (no `deleted`), so selecting it fetches `all` and narrows on deletedAt
  // below. Every other chip maps straight to a server facet.
  const listParams = {
    filter:
      filter === "all" || filter === "deleted"
        ? undefined
        : (filter as "active" | "suspended" | "flagged"),
    q: query.trim() || undefined,
  }
  const listQuery = useUserList(listParams)
  const items = React.useMemo(() => {
    const all = listQuery.data?.items ?? []
    return filter === "deleted" ? all.filter((u) => u.deletedAt) : all
  }, [listQuery.data, filter])

  // Chip counts come from the SERVER (response.counts): accurate per-facet totals over the searched set,
  // not capped to the first keyset page and stable as the facet changes. `suspended` is the explicit
  // suspended status (matching the server facet). Falls back to zeros pre-load. The `deleted` chip count
  // is derived client-side (no server facet for it) from the loaded page.
  const counts = listQuery.data?.counts ?? { all: 0, active: 0, suspended: 0, flagged: 0 }
  const deletedCount = React.useMemo(
    () => (listQuery.data?.items ?? []).filter((u) => u.deletedAt).length,
    [listQuery.data],
  )

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
            { value: "deleted", label: "Deleted", count: deletedCount },
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

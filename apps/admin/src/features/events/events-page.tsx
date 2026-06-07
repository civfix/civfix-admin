"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import {
  EVENT_STATUS_LABELS,
  type AdminEventDTO,
  type AdminEventListItemDTO,
  type EventStatus,
} from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import {
  useCancelEvent,
  useEvent,
  useEventList,
  useFlagEvent,
  usePostEventMessage,
  useSetEventStatus,
} from "@/features/events/use-events"
import { useNav, useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Events = cleanups (ported from pages-events.jsx, enumeration 2.D). Master-detail: the event queue on
 * the left (filter chips All / Upcoming / In progress / Completed / Flagged, search) and the full event
 * detail on the right (about, location minimap, activity timeline, turnout, organizer, message-attendees
 * composer, and the action bar: set status, flag, cancel). All wired to the typed admin client.
 *
 * Reconciliation: event status is upcoming | in_progress | completed | cancelled (underscore form). The
 * set-status buttons drive the three operator buckets (upcoming / in_progress / completed); "Cancel
 * event" -> cancelled. The row / header pill render whatever status the DTO carries.
 */

// Client-only Leaflet minimap (must not run during the static export).
const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="pi-map-canvas" aria-busy="true" />,
})

/**
 * Pill treatment per event status (class + design label). The pill renders `label` (the design's
 * Upcoming / In progress / Completed / Cancelled); toasts keep EVENT_STATUS_LABELS.
 */
const STATUS_VIEW: Record<EventStatus, { cls: string; label: string }> = {
  upcoming: { cls: "status-new", label: "Upcoming" },
  in_progress: { cls: "status-progress", label: "In progress" },
  completed: { cls: "status-ok", label: "Completed" },
  cancelled: { cls: "status-flag", label: "Cancelled" },
}

/** The three operator status buckets (the design's Upcoming / In progress / Completed). */
const STATUS_ACTIONS: { value: EventStatus; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
]

/** Icon per timeline entry kind. */
const TL_ICON: Record<AdminEventDTO["timeline"][number]["kind"], IconComponent> = {
  create: Icons.Pin,
  status: Icons.Clock,
  join: Icons.Users,
  message: Icons.Mail,
  done: Icons.Check,
  warn: Icons.AlertTriangle,
  cancel: Icons.Trash,
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function EventRow({
  item,
  selected,
  onClick,
}: {
  item: AdminEventListItemDTO
  selected: boolean
  onClick: () => void
}) {
  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={onClick}>
      <div className="leading">
        <span className="evt-row-ico hue-sun">
          <Icons.Calendar size={15} />
        </span>
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{item.title}</span>
          {item.flagged && (
            <span className="rep-flag-dot" title="Flagged">
              <Icons.Flag size={10} />
            </span>
          )}
          <span className="ident">{item.id}</span>
        </div>
        <div className="sub">
          <span className="strong">{item.place}</span>
          <span className="sep">·</span>
          <span>{item.attendees} attending</span>
          <span className="sep">·</span>
          <span>{firstName(item.organizer.name)}</span>
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${STATUS_VIEW[item.status].cls} tight`}>
          {STATUS_VIEW[item.status].label}
        </span>
        <span className="age">{item.date.rel.replace(/^[A-Za-z]+, /, "")}</span>
      </div>
    </div>
  )
}

function EventDetail({ eventId, onCancelled }: { eventId: string; onCancelled: (id: string) => void }) {
  const q = useEvent(eventId)
  const nav = useNav()
  const toast = useToast()

  const setStatus = useSetEventStatus()
  const flag = useFlagEvent()
  const cancel = useCancelEvent()
  const postMessage = usePostEventMessage()

  const [text, setText] = React.useState("")

  if (q.isLoading) return <LoadingState label="Loading event..." />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const event = q.data
  if (!event) {
    return (
      <EmptyState
        title="No event selected"
        sub="Pick an event from the list."
        icon={<Icons.Calendar size={20} />}
      />
    )
  }

  const pct = event.capacity ? Math.min(100, Math.round((event.attendees / event.capacity) * 100)) : 0

  const send = () => {
    const body = text.trim()
    if (!body) return
    postMessage.mutate(
      { id: event.id, body },
      {
        onSuccess: () => {
          setText("")
          toast("Update posted to attendees")
        },
      },
    )
  }

  const onStatus = (status: EventStatus) => {
    if (event.status === status) return
    setStatus.mutate(
      { id: event.id, status },
      { onSuccess: () => toast(`${event.id} · status → ${EVENT_STATUS_LABELS[status]}`) },
    )
  }

  const onFlag = () => {
    flag.mutate(
      { id: event.id },
      {
        onSuccess: () =>
          toast(event.flagged ? `${event.id} · flag cleared` : `${event.id} · flagged for review`),
      },
    )
  }

  const onCancel = () => {
    cancel.mutate(
      { id: event.id },
      {
        onSuccess: () => {
          toast(`${event.id} · event cancelled`)
          onCancelled(event.id)
        },
      },
    )
  }

  return (
    <div className="rep-detail">
      <div className="rep-head">
        <span className="rep-head-pin">
          <span className="evt-head-ico hue-sun">
            <Icons.Calendar size={18} />
          </span>
        </span>
        <div className="rep-head-text">
          <div className="crumb">
            {event.id} · Cleanup event · {event.place}
          </div>
          <h2>{event.title}</h2>
        </div>
        {event.flagged && (
          <span className="pill status-flag" style={{ marginLeft: "auto" }}>
            <Icons.Flag size={11} /> Flagged
          </span>
        )}
        <span
          className={`pill ${STATUS_VIEW[event.status].cls}`}
          style={event.flagged ? undefined : { marginLeft: "auto" }}
        >
          {STATUS_VIEW[event.status].label}
        </span>
      </div>

      <div className="rep-grid">
        <div className="rep-col">
          {/* About */}
          <div className="sub">
            <div className="sub-head">
              About
              <span className="rep-confirms" style={{ marginLeft: "auto" }}>
                <Icons.Users size={12} /> {event.attendees} attending
              </span>
            </div>
            <div className="sub-body">
              <p className="rep-desc">{event.desc}</p>
              <div className="rep-loc">
                <span className="rep-loc-item">
                  <Icons.Pin size={13} /> {event.address}
                </span>
                <span className="rep-loc-sep">·</span>
                <span className="rep-loc-item">
                  <Icons.Calendar size={13} /> {event.date.abs}
                </span>
              </div>
            </div>
          </div>

          {/* Location map */}
          <div className="sub">
            <div className="sub-head">Location</div>
            <div className="sub-body" style={{ padding: 10 }}>
              <div className="rep-media">
                <div className="rep-minimap" style={{ flex: 1 }}>
                  <LeafletMap
                    pins={[
                      {
                        id: "e",
                        category: "event",
                        kind: "event",
                        lat: event.coords[0],
                        lng: event.coords[1],
                      },
                    ]}
                    center={event.coords}
                    zoom={13}
                    tint="voyager"
                    interactive={false}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Activity */}
          <div className="sub">
            <div className="sub-head">Activity</div>
            <div className="sub-body">
              <div className="rep-timeline">
                {event.timeline.map((t, i) => {
                  const Ico = TL_ICON[t.kind] ?? Icons.Clock
                  return (
                    <div
                      // eslint-disable-next-line react/no-array-index-key
                      key={i}
                      className={`rep-tl-row kind-${t.kind}`}
                    >
                      <span className="rep-tl-ico">
                        <Ico size={12} />
                      </span>
                      <div className="rep-tl-body">
                        <div className="rep-tl-text">
                          <b>{t.who}</b> {t.what}
                        </div>
                        <div className="rep-tl-when">{t.when}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="rep-col">
          {/* Turnout */}
          <div className="sub">
            <div className="sub-head">Turnout</div>
            <div className="sub-body">
              <div className="evt-turnout">
                <div className="evt-turnout-top">
                  <span className="evt-turnout-n">
                    {event.attendees}
                    <span className="evt-turnout-cap"> / {event.capacity ?? "-"}</span>
                  </span>
                  <span className="evt-turnout-lbl">
                    {event.status === "completed" ? "attended" : "RSVP’d"}
                  </span>
                </div>
                <div className="evt-turnout-bar">
                  <span style={{ width: pct + "%" }} />
                </div>
              </div>
              {event.bags > 0 && (
                <div className="evt-stat-row">
                  <span className="evt-stat">
                    <Icons.Trash size={13} /> <b>{event.bags}</b> bags collected
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Organizer */}
          <div className="sub">
            <div className="sub-head">Organizer</div>
            <div className="sub-body">
              <div className="user-head">
                <span
                  className="user-av"
                  style={{
                    background:
                      event.organizer.trust === "Unverified"
                        ? "var(--ink-4)"
                        : "linear-gradient(135deg, var(--sun), var(--moss))",
                  }}
                >
                  {initials(event.organizer.name)}
                </span>
                <div>
                  <div className="user-name">{event.organizer.name}</div>
                  <div className="user-handle mono">{event.organizer.handle}</div>
                </div>
              </div>
              <div
                className={`trust-badge ${
                  event.organizer.trust === "Unverified" ? "unverified" : "verified"
                }`}
              >
                {event.organizer.trust === "Unverified" ? (
                  <Icons.AlertTriangle size={11} />
                ) : (
                  <Icons.Check size={11} />
                )}
                {event.organizer.trust}
              </div>
              <div className="user-meta-rows">
                <div className="umr">
                  <span>Member</span>
                  <span className="mono">{event.organizer.joined}</span>
                </div>
              </div>
              <button className="btn sm ghost full" onClick={() => nav("users", event.organizer.id)}>
                View full account →
              </button>
            </div>
          </div>

          {/* Message attendees */}
          <div className="sub">
            <div className="sub-head">Message attendees</div>
            <div className="sub-body">
              {event.messages.length > 0 && (
                <div className="evt-msgs">
                  {event.messages.map((m, i) => (
                    <div
                      // eslint-disable-next-line react/no-array-index-key
                      key={i}
                      className="evt-msg"
                    >
                      <span className="evt-msg-who">{m.who}</span>
                      <span className="evt-msg-text">{m.text}</span>
                      <span className="evt-msg-when">{m.when}</span>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                className="rep-followup"
                rows={2}
                placeholder={`Post an update to ${event.attendees} attendees…`}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                className="btn primary full"
                disabled={!text.trim() || postMessage.isPending}
                onClick={send}
                style={!text.trim() ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              >
                <Icons.Send size={13} /> Post update
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="rep-actions">
        <span className="rep-actions-label">Set status</span>
        {STATUS_ACTIONS.map((s) => (
          <button
            key={s.value}
            className={`btn sm ${event.status === s.value ? "primary" : ""}`}
            disabled={setStatus.isPending}
            onClick={() => onStatus(s.value)}
          >
            {event.status === s.value && <Icons.Check size={11} />}
            {s.label}
          </button>
        ))}
        <div className="spacer" />
        <button
          className={`btn ${event.flagged ? "flag-on" : ""}`}
          disabled={flag.isPending}
          onClick={onFlag}
        >
          <Icons.Flag size={13} /> {event.flagged ? "Flagged" : "Flag"}
        </button>
        <button className="btn danger" disabled={cancel.isPending} onClick={onCancel}>
          <Icons.Trash size={13} /> Cancel event
        </button>
      </div>
    </div>
  )
}

export function EventsPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const listParams = {
    filter:
      filter === "all"
        ? undefined
        : (filter as "upcoming" | "in_progress" | "completed" | "flagged"),
    q: query.trim() || undefined,
  }
  const listQuery = useEventList(listParams)
  const items = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data])

  // Unfiltered fetch for stable chip counts across filters.
  const allQuery = useEventList({})
  const allItems = React.useMemo(() => allQuery.data?.items ?? [], [allQuery.data])
  const counts = {
    all: allItems.length,
    upcoming: allItems.filter((e) => e.status === "upcoming").length,
    in_progress: allItems.filter((e) => e.status === "in_progress").length,
    completed: allItems.filter((e) => e.status === "completed").length,
    flagged: allItems.filter((e) => e.flagged).length,
  }

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.id)
    if (selId && items.length && !items.some((x) => x.id === selId)) setSelId(items[0]!.id)
  }, [items, selId])

  const onCancelled = (id: string) => {
    setSelId((cur) => (cur === id ? null : cur))
  }

  return (
    <>
      <PageHead
        title="Events"
        subtitle={
          <span>
            Community cleanup events neighbors organize on civfix — track turnout, keep them on the
            level, and message attendees.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "upcoming", label: "Upcoming", count: counts.upcoming },
            { value: "in_progress", label: "In progress", count: counts.in_progress },
            { value: "completed", label: "Completed", count: counts.completed },
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
            placeholder="Search title, place, organizer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Events</h3>
            <div className="spacer" />
            <span className="meta">{items.length}</span>
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading events..." />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                title="Nothing matches"
                sub="Try a different filter or search."
                icon={<Icons.Search size={20} />}
              />
            ) : (
              items.map((e) => (
                <EventRow
                  key={e.id}
                  item={e}
                  selected={selId === e.id}
                  onClick={() => setSelId(e.id)}
                />
              ))
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            <EventDetail key={selId} eventId={selId} onCancelled={onCancelled} />
          ) : (
            <EmptyState
              title="No event selected"
              sub="Pick an event from the list."
              icon={<Icons.Calendar size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

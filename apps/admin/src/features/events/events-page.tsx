"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import {
  EVENT_STATUS_LABELS,
  REPORT_CATEGORY_LABELS,
  type AdminEventDTO,
  type AdminEventListItemDTO,
  type AdminReportListItemDTO,
  type EventStatus,
  type LinkedReportRef,
} from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog } from "@/components/shared/dialog"
import { useDebounced } from "@/hooks/use-debounced"
import { EVENT_STATUS_VIEW } from "@/lib/event-status"
import { eventKindView, EVENT_KIND_PIN_KIND } from "@/lib/event-kind"
import { reportStatusView } from "@/lib/report-status"
import {
  useCancelEvent,
  useEvent,
  useEventListInfinite,
  useFlagEvent,
  useLinkReports,
  usePostEventMessage,
  useSetEventOutcome,
  useSetEventStatus,
  useUnlinkReport,
} from "@/features/events/use-events"
import { useReportList } from "@/features/reports/use-reports"
import { useNav, useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"


const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="pi-map-canvas" aria-busy="true" />,
})

const STATUS_VIEW = EVENT_STATUS_VIEW

const STATUS_ACTIONS: { value: EventStatus; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
]

const TL_ICON: Record<AdminEventDTO["timeline"][number]["kind"], IconComponent> = {
  create: Icons.Pin,
  status: Icons.Clock,
  join: Icons.Users,
  message: Icons.Mail,
  done: Icons.Check,
  warn: Icons.AlertTriangle,
  cancel: Icons.Trash,
  linked: Icons.Layers,
  unlinked: Icons.X,
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name
}

function shortId(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 8)}`
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function catPinSrc(category: LinkedReportRef["category"]): string | null {
  if (category === "other") return null
  return `/ds/pin-${category}.svg`
}

function LinkedReportCard({
  report,
  onOpen,
  onUnlink,
  unlinking,
}: {
  report: LinkedReportRef
  onOpen: () => void
  onUnlink?: () => void
  unlinking?: boolean
}) {
  const view = reportStatusView(report.status)
  const pin = catPinSrc(report.category)
  const card = (
    <button className="evt-linked-card" onClick={onOpen} title={report.title}>
      <span className="evt-linked-thumb" aria-hidden="true">
        {report.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={report.thumbUrl} alt="" />
        ) : pin ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pin} alt="" />
        ) : (
          <Icons.Layers size={16} />
        )}
      </span>
      <span className="evt-linked-body">
        <span className="evt-linked-title">{report.title}</span>
        <span className="evt-linked-sub">
          <span className={`pill ${view.cls} tight`}>{view.label}</span>
          <span className="evt-linked-cat">{REPORT_CATEGORY_LABELS[report.category]}</span>
        </span>
        {report.addr && <span className="evt-linked-addr">{report.addr}</span>}
      </span>
    </button>
  )
  if (!onUnlink) return card
  return (
    <div className="evt-linked-row">
      {card}
      <button
        className="evt-linked-unlink"
        disabled={unlinking}
        onClick={onUnlink}
        title="Unlink this report from the cleanup"
      >
        <Icons.X size={12} /> Remove
      </button>
    </div>
  )
}

function LinkReportsPicker({
  excludeIds,
  pending,
  onClose,
  onLink,
}: {
  excludeIds: Set<string>
  pending: boolean
  onClose: () => void
  onLink: (reportIds: string[]) => void
}) {
  const [query, setQuery] = React.useState("")
  const [picked, setPicked] = React.useState<Set<string>>(() => new Set())

  const listQuery = useReportList({ q: query.trim() || undefined })
  const candidates = React.useMemo<AdminReportListItemDTO[]>(
    () => (listQuery.data?.items ?? []).filter((r) => !excludeIds.has(r.id)),
    [listQuery.data, excludeIds],
  )

  const toggle = (id: string) => {
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canLink = picked.size > 0 && !pending

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Link reports</h3>
          <button className="closebtn" onClick={onClose}>
            <Icons.X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="evt-pick-search">
            <Icons.Search size={14} />
            <input
              type="text"
              placeholder="Search title, place, reporter…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          {listQuery.isLoading ? (
            <LoadingState label="Loading reports..." />
          ) : listQuery.isError ? (
            <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
          ) : candidates.length === 0 ? (
            <EmptyState
              title="No reports to link"
              sub={query.trim() ? "Try a different search." : "Every matching report is already linked."}
              icon={<Icons.Search size={20} />}
            />
          ) : (
            <div className="evt-pick-list">
              {candidates.map((r) => {
                const on = picked.has(r.id)
                const view = reportStatusView(r.status)
                return (
                  <button
                    key={r.id}
                    className={`evt-pick-row ${on ? "on" : ""}`}
                    onClick={() => toggle(r.id)}
                    title={r.title}
                  >
                    <span className="evt-pick-check" aria-hidden="true">
                      {on && <Icons.Check size={12} />}
                    </span>
                    <span className="evt-pick-body">
                      <span className="evt-pick-title">{r.title}</span>
                      <span className="evt-pick-sub">
                        <span className={`pill ${view.cls} tight`}>{view.label}</span>
                        <span className="evt-linked-cat">{REPORT_CATEGORY_LABELS[r.category]}</span>
                        <span className="sep">·</span>
                        <span>{r.place}</span>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="modal-foot">
          <span className="compose-from">
            {picked.size > 0 ? `${picked.size} selected` : "Select reports to link"}
          </span>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${canLink ? "primary" : ""}`}
            disabled={!canLink}
            style={!canLink ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
            onClick={() => onLink([...picked])}
          >
            <Icons.Layers size={13} /> Link selected
          </button>
        </div>
      </div>
    </div>
  )
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
  const kindView = eventKindView(item.eventKind)
  const KindIco = kindView.icon
  const nav = useNav()
  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={onClick}>
      <div className="leading">
        <span className="evt-row-ico hue-sun" title={kindView.label}>
          <KindIco size={15} />
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
          <span className="ident" title={item.id}>
            {shortId(item.id)}
          </span>
        </div>
        <div className="sub">
          <span className="strong">{item.place}</span>
          <span className="sep">·</span>
          <span>{item.attendees} attending</span>
          <span className="sep">·</span>
          <span
            className="lnk-inline"
            role="button"
            tabIndex={0}
            title={`Open ${item.organizer.name}'s profile`}
            onClick={(e) => {
              e.stopPropagation()
              nav("users", item.organizer.id)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation()
                nav("users", item.organizer.id)
              }
            }}
          >
            {firstName(item.organizer.name)}
          </span>
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${STATUS_VIEW[item.status].cls} tight`}>
          {STATUS_VIEW[item.status].label}
        </span>
        <span className="age">{item.date.abs}</span>
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
  const outcome = useSetEventOutcome()
  const linkReports = useLinkReports()
  const unlinkReport = useUnlinkReport()

  const [text, setText] = React.useState("")
  const [bagsInput, setBagsInput] = React.useState("")
  const [pickerOpen, setPickerOpen] = React.useState(false)

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
      { onSuccess: () => toast(`${shortId(event.id)} · status → ${EVENT_STATUS_LABELS[status]}`) },
    )
  }

  const logOutcome = () => {
    const bags = Number.parseInt(bagsInput, 10)
    if (!Number.isFinite(bags) || bags < 0) return
    outcome.mutate(
      { id: event.id, bags },
      {
        onSuccess: () => {
          setBagsInput("")
          toast(`Outcome logged · ${bags} bags`)
        },
      },
    )
  }

  const onFlag = () => {
    flag.mutate(
      { id: event.id },
      {
        onSuccess: () =>
          toast(
            event.flagged
              ? `${shortId(event.id)} · flag cleared`
              : `${shortId(event.id)} · flagged for review`,
          ),
      },
    )
  }

  const onCancel = async () => {
    const ok = await confirmDialog({
      title: "Cancel this event?",
      body: "Attendees will be notified that the event is cancelled. This can't be undone.",
      danger: true,
      confirmLabel: "Cancel event",
      cancelLabel: "Keep event",
    })
    if (!ok) return
    cancel.mutate(
      { id: event.id },
      {
        onSuccess: () => {
          toast(`${shortId(event.id)} · event cancelled`)
          onCancelled(event.id)
        },
      },
    )
  }

  const onLink = (reportIds: string[]) => {
    linkReports.mutate(
      { id: event.id, reportIds },
      {
        onSuccess: () => {
          setPickerOpen(false)
          toast(
            reportIds.length === 1
              ? `${shortId(event.id)} · 1 report linked`
              : `${shortId(event.id)} · ${reportIds.length} reports linked`,
          )
        },
      },
    )
  }

  const onUnlink = (report: LinkedReportRef) => {
    if (typeof window !== "undefined" && !window.confirm(`Unlink "${report.title}" from this cleanup?`)) {
      return
    }
    unlinkReport.mutate(
      { id: event.id, reportId: report.id },
      { onSuccess: () => toast(`${shortId(event.id)} · report unlinked`) },
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
          <div className="crumb" title={event.id}>
            {shortId(event.id)} · {eventKindView(event.eventKind).label}
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
          { }
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

          { }
          <div className="sub">
            <div className="sub-head">Meet location</div>
            <div className="sub-body" style={{ padding: 10 }}>
              <div className="rep-media">
                <div className="rep-minimap" style={{ flex: 1 }}>
                  <LeafletMap
                    pins={[
                      {
                        id: "e",
                        category: "event",
                        kind: EVENT_KIND_PIN_KIND[event.eventKind],
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

          { }
          <div className="sub">
            <div className="sub-head">Activity</div>
            <div className="sub-body">
              {event.timeline.length === 0 ? (
                <EmptyState title="No activity yet" icon={<Icons.Clock size={20} />} />
              ) : (
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
              )}
            </div>
          </div>

          { }
          {event.eventKind === "cleanup" && (
            <div className="sub">
              <div className="sub-head">
                Linked reports
                <button
                  className="btn sm ghost"
                  style={{ marginLeft: "auto" }}
                  disabled={linkReports.isPending}
                  onClick={() => setPickerOpen(true)}
                >
                  <Icons.Plus size={12} /> Link reports
                </button>
                <span className="rep-confirms">
                  <Icons.Layers size={12} /> {event.linkedReports.length}
                </span>
              </div>
              <div className="sub-body">
                {event.linkedReports.length === 0 ? (
                  <EmptyState
                    title="No linked reports"
                    sub="This cleanup is not yet linked to any reports."
                    icon={<Icons.Layers size={20} />}
                  />
                ) : (
                  <div className="evt-linked-list">
                    {event.linkedReports.map((r) => (
                      <LinkedReportCard
                        key={r.id}
                        report={r}
                        onOpen={() => nav("reports", r.id)}
                        onUnlink={() => onUnlink(r)}
                        unlinking={unlinkReport.isPending}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rep-col">
          { }
          <div className="sub">
            <div className="sub-head">Turnout</div>
            <div className="sub-body">
              <div
                className="evt-turnout"
                style={event.status === "cancelled" ? { opacity: 0.6 } : undefined}
              >
                <div className="evt-turnout-top">
                  <span className="evt-turnout-n">
                    {event.attendees}
                    {event.capacity != null && (
                      <span className="evt-turnout-cap"> / {event.capacity}</span>
                    )}
                  </span>
                  <span className="evt-turnout-lbl">
                    {event.status === "cancelled"
                      ? "had RSVP’d"
                      : event.status === "completed"
                        ? "attended"
                        : "RSVP’d"}
                  </span>
                </div>
                {event.capacity != null && (
                  <div className="evt-turnout-bar">
                    <span style={{ width: pct + "%" }} />
                  </div>
                )}
              </div>
              {event.bags > 0 ? (
                <div className="evt-stat-row">
                  <span className="evt-stat">
                    <Icons.Trash size={13} /> <b>{event.bags}</b> bags collected
                  </span>
                </div>
              ) : (
                event.status === "completed" && (
                  <div className="evt-stat-row">
                    <span className="evt-stat">
                      <Icons.Trash size={13} /> No outcome logged
                    </span>
                  </div>
                )
              )}
              { }
              {(event.status === "in_progress" || event.status === "completed") && (
                <div className="evt-stat-row" style={{ gap: 8, alignItems: "center", marginTop: 6 }}>
                  <input
                    type="number"
                    min={0}
                    placeholder="bags"
                    value={bagsInput}
                    onChange={(e) => setBagsInput(e.target.value)}
                    style={{ width: 84 }}
                  />
                  <button
                    className="btn sm"
                    disabled={outcome.isPending || bagsInput.trim() === ""}
                    onClick={logOutcome}
                  >
                    {event.bags > 0 ? "Update outcome" : "Log outcome"}
                  </button>
                </div>
              )}
            </div>
          </div>

          { }
          <div className="sub">
            <div className="sub-head">Organizer</div>
            <div className="sub-body">
              <div className="user-head">
                <span
                  className="user-av"
                  style={{ background: "linear-gradient(135deg, var(--sun), var(--moss))" }}
                >
                  {initials(event.organizer.name)}
                </span>
                <div>
                  <div className="user-name">{event.organizer.name}</div>
                  <div className="user-handle mono">{event.organizer.handle}</div>
                </div>
              </div>
              {event.organizer.joined !== "-" && (
                <div className="user-meta-rows">
                  <div className="umr">
                    <span>Joined</span>
                    <span className="mono">{event.organizer.joined}</span>
                  </div>
                </div>
              )}
              <button className="btn sm ghost full" onClick={() => nav("users", event.organizer.id)}>
                View full account →
              </button>
            </div>
          </div>

          { }
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
                placeholder={
                  event.attendees === 0
                    ? "No attendees to message yet"
                    : `Post an update to ${event.attendees} attendees…`
                }
                value={text}
                disabled={event.attendees === 0}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    send()
                  }
                }}
              />
              <button
                className="btn primary full"
                disabled={event.attendees === 0 || !text.trim() || postMessage.isPending}
                onClick={send}
                style={
                  event.attendees === 0 || !text.trim()
                    ? { opacity: 0.45, cursor: "not-allowed" }
                    : undefined
                }
              >
                <Icons.Send size={13} /> Post update <span className="kbdhint">⌘⏎</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      { }
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

      { }
      {pickerOpen && event.eventKind === "cleanup" && (
        <LinkReportsPicker
          excludeIds={new Set(event.linkedReports.map((r) => r.id))}
          pending={linkReports.isPending}
          onClose={() => setPickerOpen(false)}
          onLink={onLink}
        />
      )}
    </div>
  )
}

export function EventsPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const debouncedQuery = useDebounced(query, 250)
  const listParams = {
    filter:
      filter === "all"
        ? undefined
        : (filter as "upcoming" | "in_progress" | "completed" | "flagged"),
    q: debouncedQuery.trim() || undefined,
  }
  const listQuery = useEventListInfinite(listParams)
  const items = React.useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  )

  const counts = listQuery.data?.pages[0]?.counts ?? {
    all: 0,
    upcoming: 0,
    in_progress: 0,
    completed: 0,
    flagged: 0,
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
              <>
                {items.map((e) => (
                  <EventRow
                    key={e.id}
                    item={e}
                    selected={selId === e.id}
                    onClick={() => setSelId(e.id)}
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

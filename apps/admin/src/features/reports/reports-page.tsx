"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import {
  ADMIN_REPORT_STATUS_LABELS,
  ADMIN_REPORT_STATUS_TRANSITIONS,
  REPORT_CATEGORY_LABELS,
  type AdminReportCounts,
  type AdminReportDTO,
  type AdminReportListItemDTO,
  type AdminReportStatus,
  type ChatMessageDTO,
  type LinkedEventRef,
  type ReportOutreachStatus,
} from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog } from "@/components/shared/dialog"
import { categoryCssVar, categoryPinSrc } from "@/lib/category"
import { reportStatusView } from "@/lib/report-status"
import { eventKindView } from "@/lib/event-kind"
import { getReporterProfileId } from "@/features/reports/reporter-navigation"
import { routeActionFor, type RouteAction } from "@/features/reports/route-action"
import { useDebounced } from "@/hooks/use-debounced"
import {
  useDeleteReportMessage,
  useFlagReport,
  useRemoveReport,
  useReport,
  useReportChatHistory,
  useReportListInfinite,
  useRouteReport,
  useSendReportFollowup,
  useSetReportStatus,
  useSetReportVerdict,
} from "@/features/reports/use-reports"
import { useNav, useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"


const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="pi-map-canvas" aria-busy="true" />,
})

type ReportFilter = keyof AdminReportCounts

const TL_ICON: Record<AdminReportDTO["timeline"][number]["kind"], IconComponent> = {
  submit: Icons.Pin,
  route: Icons.Send,
  confirm: Icons.Users,
  status: Icons.Clock,
  done: Icons.Check,
  warn: Icons.AlertTriangle,
  followup: Icons.Mail,
  remove: Icons.Trash,
  reply: Icons.MessageSquare,
}

const OUTREACH_VIEW: Record<
  ReportOutreachStatus,
  { cls: string; icon: IconComponent; label: string }
> = {
  not_sent: { cls: "status-new", icon: Icons.Mail, label: "Not sent" },
  sent: { cls: "status-progress", icon: Icons.Send, label: "Sent" },
  delivered: { cls: "status-progress", icon: Icons.Check, label: "Delivered" },
  replied: { cls: "status-ok", icon: Icons.MessageSquare, label: "Replied" },
  bounced: { cls: "status-flag", icon: Icons.AlertTriangle, label: "Bounced" },
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

function shortId(id: string): string {
  return `#${id.slice(0, 8)}`
}

function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}

function eventDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function LinkedEventCard({ event, onOpen }: { event: LinkedEventRef; onOpen: () => void }) {
  const view = eventKindView(event.eventKind)
  const Ico = view.icon
  return (
    <button className="evt-linked-card" onClick={onOpen} title={event.title}>
      <span className="evt-linked-thumb hue-sun" aria-hidden="true">
        <Ico size={16} />
      </span>
      <span className="evt-linked-body">
        <span className="evt-linked-title">{event.title}</span>
        <span className="evt-linked-sub">
          <span className="evt-linked-cat">{view.label}</span>
          <span className="sep">·</span>
          <span>{eventDate(event.scheduledAt)}</span>
          <span className="sep">·</span>
          <span>{pluralize(event.going, "going", "going")}</span>
        </span>
        <span className="evt-linked-addr">{firstName(event.organizer.name)}</span>
      </span>
    </button>
  )
}

const REACTION_LABEL: Record<string, string> = {
  like: "Like",
  heart: "Love",
  celebrate: "Celebrate",
  support: "Support",
  insightful: "Insightful",
  concerned: "Concerned",
}

function msgWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function routeButtonLabel(action: RouteAction): string {
  if (action.kind === "already_sent") {
    return action.routedAt ? `Already sent · ${msgWhen(action.routedAt)}` : "Already sent"
  }
  if (action.kind === "resend") return "Send again to jurisdiction"
  return "Approve & send to jurisdiction"
}

function chatAuthorName(msg: ChatMessageDTO): string {
  return msg.from?.name ?? "Removed"
}

function systemLabel(msg: ChatMessageDTO): string {
  const status = msg.system?.status
  const note = msg.system?.note?.trim()
  const body = msg.system?.body?.trim() ?? msg.body?.trim()
  const head = status ? `System · ${ADMIN_REPORT_STATUS_LABELS[status] ?? status}` : "System"
  const detail = note || body
  return detail ? `${head} — ${detail}` : head
}

/** A sender-less status event (report status changes, etc.). Read-only; can't be deleted. */
function ChatSystemRow({ msg }: { msg: ChatMessageDTO }) {
  return (
    <div className="dsc-msg system" title="Automated status event">
      <span className="dsc-msg-av" aria-hidden="true">
        <Icons.Clock size={13} />
      </span>
      <div className="dsc-msg-body">
        <div className="dsc-msg-top">
          <span className="dsc-msg-who">{systemLabel(msg)}</span>
          <span className="dsc-msg-when">{msgWhen(msg.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

function ChatMessageRow({
  msg,
  onRemove,
  removing,
  nav,
}: {
  msg: ChatMessageDTO
  onRemove: (msg: ChatMessageDTO) => void
  removing: boolean
  nav: ReturnType<typeof useNav>
}) {
  const removed = !!msg.deletedAt || msg.from == null
  const authorName = chatAuthorName(msg)
  const handle = msg.from?.handle
  const authorId = msg.from?.id
  const reactions = (msg.reactions ?? []).filter((r) => r.count > 0)
  const attachments = msg.attachments ?? []

  return (
    <div className={`dsc-msg ${removed ? "removed" : ""}`}>
      <span className="dsc-msg-av" aria-hidden="true">
        {removed ? <Icons.Trash size={13} /> : initials(authorName)}
      </span>
      <div className="dsc-msg-body">
        <div className="dsc-msg-top">
          {authorId && !removed ? (
            <span
              className="dsc-msg-who lnk-inline"
              role="button"
              tabIndex={0}
              title={`Open ${authorName}'s profile`}
              onClick={(e) => {
                e.stopPropagation()
                nav("users", authorId)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.stopPropagation()
                  nav("users", authorId)
                }
              }}
            >
              {authorName}
            </span>
          ) : (
            <span className="dsc-msg-who">{authorName}</span>
          )}
          {handle && !removed && <span className="dsc-msg-handle mono">{handle}</span>}
          {msg.forwardedToCity && (
            <span className="pill status-progress tight" title="Forwarded to the routed city">
              <Icons.Send size={10} /> Forwarded to city
            </span>
          )}
          <span className="dsc-msg-when">{msgWhen(msg.createdAt)}</span>
        </div>

        {removed ? (
          <p className="dsc-msg-text tombstone">
            <Icons.EyeOff size={12} /> Message removed
            {msg.deletedAt ? ` · ${msgWhen(msg.deletedAt)}` : ""}
          </p>
        ) : (
          <p className="dsc-msg-text">{msg.body}</p>
        )}

        {!removed && attachments.length > 0 && (
          <div className="dsc-msg-media">
            {attachments.map((m) => {
              const thumb = m.kind === "image" ? (m.thumbUrl ?? m.url) : m.thumbUrl
              return (
                <span key={m.id} className="dsc-msg-thumb">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" />
                  ) : (
                    <Icons.FileText size={14} />
                  )}
                </span>
              )
            })}
          </div>
        )}

        <div className="dsc-msg-foot">
          {reactions.length > 0 && (
            <span className="dsc-msg-reactions">
              {reactions.map((r) => (
                <span key={r.emoji} className={`dsc-reaction ${r.mine ? "mine" : ""}`}>
                  {REACTION_LABEL[r.emoji] ?? r.emoji} {r.count}
                </span>
              ))}
            </span>
          )}
          <div className="spacer" />
          {!removed && (
            <button
              className="btn sm danger"
              disabled={removing}
              onClick={() => onRemove(msg)}
              title="Remove this message (soft-delete; operators still see it as removed)"
            >
              <Icons.Trash size={11} /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Read-only report chat, as neighbors see it: the same messages from the citizen chat history
 * endpoint, including sender-less SYSTEM status events. Operators can't post — they observe and
 * moderate. Delete goes through the report chat DELETE endpoint (soft-delete) and is gated to
 * non-system rows (a status event has no author and can't be removed).
 */
function ReportDiscussion({ reportId }: { reportId: string }) {
  const q = useReportChatHistory(reportId)
  const removeMsg = useDeleteReportMessage()
  const toast = useToast()
  const nav = useNav()

  const onRemove = async (msg: ChatMessageDTO) => {
    const ok = await confirmDialog({
      title: "Remove message",
      body: "This soft-deletes the message from the report chat. Operators still see it as removed.",
      danger: true,
      confirmLabel: "Remove",
    })
    if (!ok) return
    removeMsg.mutate(
      { id: reportId, messageId: msg.id },
      { onSuccess: () => toast("Message removed") },
    )
  }

  // Oldest → newest, matching the order neighbors see in the chat.
  const items = React.useMemo(() => {
    const list = [...(q.data?.items ?? [])]
    list.sort((a, b) => {
      const ta = Date.parse(a.createdAt)
      const tb = Date.parse(b.createdAt)
      if (ta !== tb) return ta - tb
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    return list
  }, [q.data])

  return (
    <div className="sub">
      <div className="sub-head">
        Chat
        {!q.isLoading && !q.isError && (
          <span className="rep-confirms" style={{ marginLeft: "auto" }}>
            <Icons.MessageSquare size={12} /> {items.length}
          </span>
        )}
      </div>
      <div className="sub-body">
        {q.isLoading ? (
          <LoadingState label="Loading chat..." />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No messages yet"
            sub="Messages neighbors post in this report's chat appear here."
            icon={<Icons.MessageSquare size={20} />}
          />
        ) : (
          <div className="dsc-list">
            {items.map((m) =>
              m.kind === "system" || m.from == null ? (
                <ChatSystemRow key={m.id} msg={m} />
              ) : (
                <ChatMessageRow
                  key={m.id}
                  msg={m}
                  onRemove={onRemove}
                  removing={removeMsg.isPending}
                  nav={nav}
                />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const ReportRow = React.memo(function ReportRow({
  item,
  selected,
  onSelect,
}: {
  item: AdminReportListItemDTO
  selected: boolean
  onSelect: (id: string) => void
}) {
  const view = reportStatusView(item.status)
  const nav = useNav()
  const reporterId = getReporterProfileId(item.reporter.id)
  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={() => onSelect(item.id)}>
      <div className="leading has-pin" title={REPORT_CATEGORY_LABELS[item.category]}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={categoryPinSrc(item.category)} alt="" />
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
          {reporterId ? (
            <button
              type="button"
              className="lnk-inline"
              title={`Open ${item.reporter.name}'s profile`}
              onClick={(e) => {
                e.stopPropagation()
                nav("users", reporterId)
              }}
            >
              {firstName(item.reporter.name)}
            </button>
          ) : (
            <span>{firstName(item.reporter.name)}</span>
          )}
          {item.confirmations > 0 && (
            <>
              <span className="sep">·</span>
              <span>{pluralize(item.confirmations, "confirm")}</span>
            </>
          )}
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${view.cls} tight`}>{view.label}</span>
        <span className="age">{item.submitted.rel}</span>
      </div>
    </div>
  )
})

function ReportDetail({ reportId, onRemoved }: { reportId: string; onRemoved: (id: string) => void }) {
  const q = useReport(reportId)
  const nav = useNav()
  const toast = useToast()

  const setStatus = useSetReportStatus()
  const flag = useFlagReport()
  const remove = useRemoveReport()
  const followup = useSendReportFollowup()
  const route = useRouteReport()
  const verdict = useSetReportVerdict()

  const [to, setTo] = React.useState<"reporter" | "city">("reporter")
  const [text, setText] = React.useState("")
  const [routeOpen, setRouteOpen] = React.useState(false)
  const [routeNote, setRouteNote] = React.useState("")
  const [lastThreadId, setLastThreadId] = React.useState<string | null>(null)

  if (q.isLoading) return <LoadingState label="Loading report..." />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const report = q.data
  if (!report) return null

  const view = reportStatusView(report.status)
  const outreachView = OUTREACH_VIEW[report.outreach.status] ?? OUTREACH_VIEW.not_sent
  const OutreachIco = outreachView.icon
  const canCity = !!report.city.contact
  const routeAction = routeActionFor(report)
  const statusActions = ADMIN_REPORT_STATUS_TRANSITIONS[report.status]
  const reporterProfileId = getReporterProfileId(report.reporter.id)
  const canReporter = reporterProfileId !== null
  const target: "reporter" | "city" = to === "reporter" && !canReporter ? "city" : to
  const canSend = target === "reporter" ? canReporter : canCity
  const pin = categoryPinSrc(report.category)
  const previewMedia = report.media.find((m) => m.kind === "image") ?? report.media[0]
  const photoUrl = previewMedia
    ? previewMedia.kind === "image"
      ? (previewMedia.thumbUrl ?? previewMedia.url)
      : (previewMedia.thumbUrl ?? null)
    : null
  const galleryMedia = previewMedia
    ? report.media.filter((m) => m.id !== previewMedia?.id)
    : report.media

  const send = () => {
    const body = text.trim()
    if (!body || !canSend) return
    followup.mutate(
      { id: report.id, to: target, body },
      {
        onSuccess: () => {
          setText("")
          toast(`Follow-up sent to ${target === "reporter" ? "reporter" : "city"}`)
        },
      },
    )
  }

  const openRoute = () => {
    setRouteNote("")
    setRouteOpen(true)
  }

  const sendToJurisdiction = async () => {
    const contact = report.city.contact
    if (!contact || route.isPending) return
    const note = routeNote.trim()
    const ok = await confirmDialog({
      title: "Send to the city?",
      body: `This emails the report to ${contact}. Attached photos are included.`,
      confirmLabel: "Send",
    })
    if (!ok) return
    route.mutate(
      {
        id: report.id,
        ...(note ? { note } : {}),
      },
      {
        onSuccess: (res) => {
          setRouteOpen(false)
          setRouteNote("")
          setLastThreadId(res.threadId)
          toast(`Sent to ${res.routedTo}`)
        },
      },
    )
  }

  const onStatus = async (status: AdminReportStatus) => {
    if (status === report.status) return
    if (status === "held") {
      const ok = await confirmDialog({
        title: "Move report back?",
        body: "Moving a live report to Under review hides it from the public map.",
        danger: true,
      })
      if (!ok) return
    }
    setStatus.mutate(
      { id: report.id, status },
      { onSuccess: () => toast(`${shortId(report.id)} · status → ${ADMIN_REPORT_STATUS_LABELS[status]}`) },
    )
  }

  const onFlag = () => {
    flag.mutate(
      { id: report.id },
      {
        onSuccess: () =>
          toast(
            report.flagged
              ? `${shortId(report.id)} · flag cleared`
              : `${shortId(report.id)} · flagged for review`,
          ),
      },
    )
  }

  const onRemove = async () => {
    const ok = await confirmDialog({
      title: "Remove report",
      body: "This removes the report from the public map and queue.",
      danger: true,
      confirmLabel: "Remove",
    })
    if (!ok) return
    remove.mutate(
      { id: report.id },
      {
        onSuccess: () => {
          toast(`${shortId(report.id)} · report removed`)
          onRemoved(report.id)
        },
      },
    )
  }

  const onVerdict = async (v: "approved" | "rejected") => {
    if (v === "rejected") {
      const ok = await confirmDialog({
        title: "Reject report",
        body: "This rejects the report's verification verdict.",
        danger: true,
        confirmLabel: "Reject",
      })
      if (!ok) return
    }
    verdict.mutate(
      { id: report.id, verdict: v },
      {
        onSuccess: () =>
          toast(`${shortId(report.id)} · ${v === "approved" ? "approved" : "rejected"}`),
      },
    )
  }

  return (
    <div className="rep-detail">
      { }
      <div className="rep-head">
        <span className="rep-head-pin">
          {pin ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pin} alt="" />
          ) : (
            <Icons.Layers size={22} />
          )}
        </span>
        <div className="rep-head-text">
          <div className="crumb" title={report.id}>
            <span className="mono" style={{ color: "var(--ink-3)" }}>
              {report.referenceCode ?? shortId(report.id)}
            </span>{" "}
            · {REPORT_CATEGORY_LABELS[report.category]} · {report.place}
          </div>
          <h2>{report.title}</h2>
        </div>
        {report.flagged && (
          <span className="pill status-flag" style={{ marginLeft: "auto" }}>
            <Icons.Flag size={11} /> Flagged
          </span>
        )}
        { }
        <span
          className={`pill ${outreachView.cls} tight`}
          style={report.flagged ? undefined : { marginLeft: "auto" }}
          title="Outreach to the jurisdiction"
        >
          <OutreachIco size={11} /> {outreachView.label}
        </span>
        <span className={`pill ${view.cls}`}>{view.label}</span>
      </div>

      <div className="rep-grid">
        <div className="rep-col">
          { }
          <div className="sub">
            <div className="sub-head">
              Report
              <span className="rep-confirms" style={{ marginLeft: "auto" }}>
                <Icons.Users size={12} />{" "}
                {report.confirmations === 1
                  ? "1 neighbor confirmed"
                  : `${report.confirmations} neighbors confirmed`}
              </span>
            </div>
            <div className="sub-body">
              <p className="rep-desc">{report.desc}</p>
              <div className="rep-loc">
                <span className="rep-loc-item">
                  <Icons.Pin size={13} /> {report.address}
                </span>
                <span className="rep-loc-sep">·</span>
                <span className="rep-loc-item">
                  <Icons.Clock size={13} /> Submitted {report.submitted.abs}
                </span>
              </div>
            </div>
          </div>

          { }
          <div className="sub">
            <div className="sub-head">
              Location
              {report.coords && (
                <a
                  className="btn sm ghost"
                  style={{ marginLeft: "auto" }}
                  href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${report.coords[0]},${report.coords[1]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open this location in Google Street View"
                >
                  <Icons.Eye size={11} /> Street View
                </a>
              )}
            </div>
            <div className="sub-body" style={{ padding: 10 }}>
              <div className="rep-media">
                {report.hasPhoto && (
                  <div className="rep-photo" style={{ ["--cat" as string]: categoryCssVar(report.category) }}>
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="rep-photo-img" src={photoUrl} alt="Reporter photo" />
                    ) : (
                      <span
                        className="rep-photo-pin"
                        style={{ background: categoryCssVar(report.category) }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={pin} alt="" />
                      </span>
                    )}
                    {photoUrl && (
                      <span className="rep-photo-tag">
                        <Icons.Eye size={12} /> Reporter photo
                      </span>
                    )}
                  </div>
                )}
                <div className="rep-minimap">
                  <LeafletMap
                    pins={[
                      {
                        id: "r",
                        category: report.category,
                        lat: report.coords[0],
                        lng: report.coords[1],
                      },
                    ]}
                    center={report.coords}
                    zoom={14}
                    tint="voyager"
                    interactive={false}
                  />
                </div>
              </div>
            </div>
          </div>

          { }
          {galleryMedia.length > 0 && (
            <div className="sub">
              <div className="sub-head">
                Photos
                <span className="rep-confirms" style={{ marginLeft: "auto" }}>
                  <Icons.Eye size={12} /> {galleryMedia.length}
                </span>
              </div>
              <div className="sub-body" style={{ padding: 10 }}>
                <div className="dsc-msg-media">
                  {galleryMedia.map((m) => {
                    const thumb = m.kind === "image" ? (m.thumbUrl ?? m.url) : m.thumbUrl
                    return (
                      <a
                        key={m.id}
                        className="dsc-msg-thumb"
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open full media in a new tab"
                      >
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" />
                        ) : (
                          <Icons.FileText size={14} />
                        )}
                      </a>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          { }
          <div className="sub">
            <div className="sub-head">Activity</div>
            <div className="sub-body">
              {report.timeline.length === 0 ? (
                <EmptyState
                  title="No activity yet"
                  sub="Updates appear here as this report is routed, confirmed, and resolved."
                  icon={<Icons.Clock size={20} />}
                />
              ) : (
                <div className="rep-timeline">
                  {report.timeline.map((t, i) => {
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
          {report.linkedEvents.length > 0 && (
            <div className="sub">
              <div className="sub-head">
                Linked events
                <span className="rep-confirms" style={{ marginLeft: "auto" }}>
                  <Icons.Calendar size={12} /> {report.linkedEvents.length}
                </span>
              </div>
              <div className="sub-body">
                <div className="evt-linked-list">
                  {report.linkedEvents.map((e) => (
                    <LinkedEventCard key={e.id} event={e} onOpen={() => nav("events", e.id)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          { }
          <ReportDiscussion reportId={report.id} />
        </div>

        <div className="rep-col">
          { }
          <div className="sub">
            <div className="sub-head">Reporter</div>
            <div className="sub-body">
              <div className="user-head">
                <span
                  className="user-av"
                  style={{ background: "linear-gradient(135deg, var(--sky), var(--moss))" }}
                >
                  {initials(report.reporter.name)}
                </span>
                <div>
                  <div className="user-name">{report.reporter.name}</div>
                  <div className="user-handle mono">{report.reporter.handle}</div>
                </div>
              </div>
              <div className="user-meta-rows">
                <div className="umr">
                  <span>Joined</span>
                  <span className="mono">{report.reporter.joined}</span>
                </div>
              </div>
              {reporterProfileId && (
                <button
                  className="btn sm ghost full"
                  onClick={() => nav("users", reporterProfileId)}
                >
                  View full account →
                </button>
              )}
            </div>
          </div>

          { }
          <div className="sub">
            <div className="sub-head">
              Routed to
              {report.geoid && (
                <button
                  className="btn sm ghost"
                  style={{ marginLeft: "auto" }}
                  onClick={() => nav("discovery", report.geoid)}
                  title="Open this jurisdiction in Jurisdictions"
                >
                  <Icons.Building size={11} /> Jurisdiction →
                </button>
              )}
            </div>
            <div className="sub-body">
              <div className="rep-city">
                <span className="rep-city-ico">
                  <Icons.Building size={15} />
                </span>
                <div>
                  <div className="rep-city-dept">{report.city.dept}</div>
                  {report.city.dept !== report.place && (
                    <div className="rep-city-place">{report.place}</div>
                  )}
                </div>
              </div>
              {canCity ? (
                <div className="rep-city-contact">
                  <Icons.Mail size={12} />
                  <span className="mono">{report.city.contact}</span>
                </div>
              ) : (
                <div className="rep-city-contact warn">
                  <Icons.AlertTriangle size={12} />
                  <span>No contact on file — set one in Jurisdictions</span>
                </div>
              )}

              { }
              <div className="rep-city-contact" style={{ marginTop: 8 }}>
                <OutreachIco size={12} />
                <span>
                  Outreach: <b>{outreachView.label}</b>
                  {report.outreach.routedTo && report.outreach.status !== "not_sent" && (
                    <>
                      {" "}
                      · <span className="mono">{report.outreach.routedTo}</span>
                    </>
                  )}
                </span>
              </div>
              {report.outreach.threadId && (
                <button
                  className="btn sm ghost full"
                  style={{ marginTop: 6 }}
                  onClick={() => nav("mail", report.outreach.threadId)}
                  title="Open the jurisdiction conversation in Mail"
                >
                  <Icons.MessageSquare size={12} /> View conversation →
                </button>
              )}
            </div>
          </div>

          { }
          <div className="sub">
            <div className="sub-head">
              Verification
              <span
                className={`pill tight ${
                  report.verificationVerdict === "approved"
                    ? "status-ok"
                    : report.verificationVerdict === "rejected"
                      ? "status-flag"
                      : "status-new"
                }`}
                style={{ marginLeft: "auto" }}
              >
                {report.verificationVerdict === "approved"
                  ? "Approved"
                  : report.verificationVerdict === "rejected"
                    ? "Rejected"
                    : "Not yet reviewed"}
              </span>
            </div>
            <div className="sub-body">
              <div className="rep-loc">
                <span className="rep-loc-item">
                  <Icons.Shield size={13} /> Reporter:{" "}
                  {report.reporterReportVerified ? "report-verified" : "not report-verified"}
                </span>
                {report.verifiedAt && (
                  <>
                    <span className="rep-loc-sep">·</span>
                    <span className="rep-loc-item">
                      <Icons.Clock size={13} /> {msgWhen(report.verifiedAt)}
                    </span>
                  </>
                )}
              </div>
              <div className="rep-to" style={{ marginTop: 8 }}>
                <button
                  className={`btn full ${report.verificationVerdict === "approved" ? "" : "success"}`}
                  disabled={verdict.isPending}
                  onClick={() => onVerdict("approved")}
                >
                  <Icons.Check size={13} /> Approve
                </button>
                <button
                  className="btn danger"
                  disabled={verdict.isPending}
                  onClick={() => onVerdict("rejected")}
                >
                  <Icons.X size={13} /> Reject
                </button>
              </div>
            </div>
          </div>

          { }
          <div className="sub">
            <div className="sub-head">Send to jurisdiction</div>
            <div className="sub-body">
              {routeAction.kind === "no_contact" || routeAction.kind === "no_jurisdiction" ? (
                <>
                  <div className="hint">
                    {routeAction.kind === "no_jurisdiction"
                      ? "This report's location did not resolve to a jurisdiction. Reports are only forwarded to a contact on file."
                      : "This jurisdiction has no routing contact on file. Reports are only forwarded to a contact on file."}
                  </div>
                  {report.geoid !== null && (
                    <button
                      className="btn full"
                      style={{ marginTop: 8 }}
                      onClick={() => nav("discovery", report.geoid)}
                    >
                      <Icons.Building size={13} /> Set the routing contact in Jurisdictions
                    </button>
                  )}
                </>
              ) : !routeOpen ? (
                <>
                  <button
                    className="btn primary full"
                    disabled={routeAction.kind === "already_sent"}
                    style={
                      routeAction.kind === "already_sent"
                        ? { opacity: 0.45, cursor: "not-allowed" }
                        : undefined
                    }
                    title={
                      routeAction.kind === "already_sent"
                        ? "This report was already sent. Resend it from the Mail thread."
                        : undefined
                    }
                    onClick={openRoute}
                  >
                    <Icons.Send size={13} /> {routeButtonLabel(routeAction)}
                  </button>
                  {lastThreadId && (
                    <button
                      className="btn sm ghost full"
                      style={{ marginTop: 8 }}
                      onClick={() => nav("mail", lastThreadId)}
                      title="Open the jurisdiction conversation in Mail"
                    >
                      <Icons.MessageSquare size={12} /> View conversation →
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="rep-city-contact">
                    <Icons.Mail size={12} />
                    <span className="mono">{report.city.contact}</span>
                  </div>
                  <textarea
                    className="rep-followup"
                    style={{ marginTop: 8 }}
                    rows={3}
                    placeholder="Optional note to include in the email packet…"
                    value={routeNote}
                    onChange={(e) => setRouteNote(e.target.value)}
                  />
                  <div className="rep-to" style={{ marginTop: 8 }}>
                    <button
                      className="btn primary full"
                      disabled={route.isPending}
                      onClick={sendToJurisdiction}
                    >
                      <Icons.Send size={13} /> Send
                    </button>
                    <button
                      className="btn"
                      disabled={route.isPending}
                      onClick={() => setRouteOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          { }
          <div className="sub">
            <div className="sub-head">Send a follow-up</div>
            <div className="sub-body">
              <div className="rep-to">
                <button
                  className={`rep-to-btn ${target === "reporter" ? "on" : ""}`}
                  onClick={() => canReporter && setTo("reporter")}
                  disabled={!canReporter}
                  title={canReporter ? "" : "Anonymous report — no reporter account to message"}
                >
                  <Icons.Users size={12} /> Reporter
                </button>
                <button
                  className={`rep-to-btn ${target === "city" ? "on" : ""}`}
                  onClick={() => canCity && setTo("city")}
                  disabled={!canCity}
                  title={canCity ? "" : "No city contact on file"}
                >
                  <Icons.Building size={12} /> City
                </button>
              </div>
              <textarea
                className="rep-followup"
                rows={3}
                placeholder={
                  target === "reporter"
                    ? `Message ${firstName(report.reporter.name)} — e.g. a status update or a question…`
                    : `Message ${report.city.dept} — e.g. nudge for an update…`
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                className="btn primary full"
                disabled={!text.trim() || !canSend || followup.isPending}
                onClick={send}
                style={!text.trim() || !canSend ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              >
                <Icons.Send size={13} /> Send to {target === "reporter" ? "reporter" : "city"}
              </button>
            </div>
          </div>
        </div>
      </div>

      { }
      <div className="rep-actions">
        <span className="rep-actions-label">Quick status</span>
        {statusActions.length === 0 ? (
          <span className="hint">No status changes from {ADMIN_REPORT_STATUS_LABELS[report.status]}</span>
        ) : (
          statusActions.map((s) => (
            <button
              key={s}
              className="btn sm"
              disabled={setStatus.isPending}
              onClick={() => onStatus(s)}
            >
              {ADMIN_REPORT_STATUS_LABELS[s]}
            </button>
          ))
        )}
        <div className="spacer" />
        <button
          className={`btn ${report.flagged ? "flag-on" : ""}`}
          disabled={flag.isPending}
          onClick={onFlag}
        >
          <Icons.Flag size={13} /> {report.flagged ? "Flagged" : "Flag"}
        </button>
        <button className="btn danger" disabled={remove.isPending} onClick={onRemove}>
          <Icons.Trash size={13} /> Remove report
        </button>
      </div>
    </div>
  )
}

export function ReportsPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<ReportFilter>("all")
  const [query, setQuery] = React.useState("")
  const dq = useDebounced(query, 250)
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const listParams = {
    filter: filter === "all" ? undefined : filter,
    q: dq.trim() || undefined,
  }
  const listQuery = useReportListInfinite(listParams)
  const items = React.useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  )

  const serverCounts: AdminReportCounts | null = listQuery.data?.pages[0]?.counts ?? null
  const counts = serverCounts ?? {
    all: 0,
    submitted: 0,
    in_progress: 0,
    completed: 0,
    flagged: 0,
  }
  const listCount = serverCounts ? serverCounts[filter] : items.length

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.id)
  }, [items, selId])

  const selInList = selId !== null && items.some((x) => x.id === selId)
  const pinnedQuery = useReport(selInList ? null : selId)
  const pinned = selInList ? null : (pinnedQuery.data ?? null)

  const onRemoved = (id: string) => {
    setSelId((cur) => (cur === id ? null : cur))
  }

  return (
    <>
      <PageHead
        title="Reports"
        subtitle={
          <span>
            Every report neighbors submit — routed to the right city department. Track status, follow up
            with the reporter or the city, and close the loop.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "submitted", label: "Submitted", count: counts.submitted },
            { value: "in_progress", label: "In progress", count: counts.in_progress },
            { value: "completed", label: "Completed", count: counts.completed },
            { value: "flagged", label: "Flagged", count: counts.flagged },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as ReportFilter)}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            placeholder="Search title, place, reporter…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Reports</h3>
            <div className="spacer" />
            <span className="meta">{listCount}</span>
          </div>
          <div className="queue-list">
            {pinned && (
              <>
                <div className="eyebrow" style={{ padding: "10px 10px 0" }}>
                  Linked report
                </div>
                <ReportRow item={pinned} selected onSelect={setSelId} />
              </>
            )}
            {listQuery.isLoading ? (
              <LoadingState label="Loading reports..." />
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
                {items.map((r) => (
                  <ReportRow key={r.id} item={r} selected={selId === r.id} onSelect={setSelId} />
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
            <ReportDetail key={selId} reportId={selId} onRemoved={onRemoved} />
          ) : (
            <EmptyState
              title="No report selected"
              sub="Pick a report from the list."
              icon={<Icons.FileText size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

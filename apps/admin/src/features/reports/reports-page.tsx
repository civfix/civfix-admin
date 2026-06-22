"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import {
  ADMIN_REPORT_STATUS_LABELS,
  REPORT_CATEGORY_LABELS,
  type AdminReportDTO,
  type AdminReportListItemDTO,
  type AdminReportStatus,
  type DiscussionMessageDTO,
  type LinkedEventRef,
  type ReportCategory,
  type ReportOutreachStatus,
} from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { reportBucket, reportStatusView } from "@/lib/report-status"
import { eventKindView } from "@/lib/event-kind"
import {
  useFlagReport,
  useRemoveDiscussionMessage,
  useRemoveReport,
  useReport,
  useReportDiscussion,
  useReportList,
  useRouteReport,
  useSendReportFollowup,
  useSetReportStatus,
  useSetReportVerdict,
} from "@/features/reports/use-reports"
import { useNav, useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Reports (ported from pages-reports.jsx, enumeration 2.C). Master-detail: the report queue on the left
 * (filter chips All / Submitted / In progress / Completed / Flagged, search) and the full report detail
 * on the right (description, location + minimap, activity timeline, reporter, routing, follow-up
 * composer, and the action bar: quick status, flag, remove). All wired to the typed admin client.
 *
 * Reconciliation: the design's submitted|in-progress|completed becomes the civfix status enum. The
 * quick-status buttons drive the three real buckets (submitted | in_progress | resolved); the row /
 * header pill render the design bucket label for whatever civfix status the DTO carries via the canonical
 * reportStatusView helper (src/lib/report-status.ts). "flagged" is the orthogonal abuse marker, not a
 * status. NOTE: a freshly created authed pin is `published` (live, awaiting city action) — it reads as
 * "Submitted", NOT "Completed".
 */

// Client-only Leaflet minimap (must not run during the static export).
const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="pi-map-canvas" aria-busy="true" />,
})

/** The three quick-status buckets (the design's Submitted / In progress / Completed). */
const STATUS_ACTIONS: { value: AdminReportStatus; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Completed" },
]

/** Icon per timeline entry kind (ported from TL_ICON). */
const TL_ICON: Record<AdminReportDTO["timeline"][number]["kind"], IconComponent> = {
  submit: Icons.Pin,
  route: Icons.Send,
  confirm: Icons.Users,
  status: Icons.Clock,
  done: Icons.Check,
  warn: Icons.AlertTriangle,
  followup: Icons.Mail,
  remove: Icons.Trash,
  // A jurisdiction reply threaded back onto the report (the city responded to our outreach).
  reply: Icons.MessageSquare,
}

/**
 * Pill treatment per outreach status (the email lifecycle of a report's send to its jurisdiction —
 * orthogonal to the civic report status). Reuses the admin design-system `.pill` status classes.
 */
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

function catPinSrc(category: ReportCategory): string | null {
  if (category === "other") return null
  return `/ds/pin-${category}.svg`
}

/** Per-category hue var for the held-photo placeholder tint ("other" -> neutral ink). */
function catColor(category: ReportCategory): string {
  if (category === "other") return "var(--ink-4)"
  return `var(--cat-${category})`
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

/** A human-friendly short report id ("#" + first 8 chars of the uuid) for display only. */
function shortId(id: string): string {
  return `#${id.slice(0, 8)}`
}

/** Pluralize a noun against a count: pluralize(1, "confirm") -> "1 confirm". */
function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/** Format an ISO scheduledAt for the linked-event card (e.g. "Jun 17, 2026"); falls back to the raw value. */
function eventDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

/**
 * A linked-event (cleanup) card in the report's "Linked events" gallery: the event-kind icon + label,
 * title, scheduled date, attendee count, and organizer. Tapping it deep-links into the Events section
 * with that event focused.
 */
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

/**
 * Human label per reaction NAME. The discussion contract's `reactions[].emoji` values are the six ASCII
 * reaction names (not Unicode glyphs), so the summary chips render the name + count (no emoji font
 * dependency). An unknown name falls back to itself.
 */
const REACTION_LABEL: Record<string, string> = {
  like: "Like",
  heart: "Love",
  celebrate: "Celebrate",
  support: "Support",
  insightful: "Insightful",
  concerned: "Concerned",
}

/** Format a raw ISO discussion timestamp (createdAt/editedAt) for display; falls back to the raw value. */
function msgWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/**
 * One discussion message (a public comment on the report). Operators see EVERY message including
 * soft-removed ones (rendered as a subtle tombstone, not hidden). Replies render indented under their
 * parent via the `depth` prop. Renders: author (displayName/handle, or "Removed" when soft-deleted /
 * the author is null), the body, a "Forwarded to city" badge, the per-emoji reaction summary, the reply
 * count, attachment thumbnails, and a per-message Remove action for live (non-removed) messages.
 */
function DiscussionMessageRow({
  msg,
  depth,
  onRemove,
  removing,
}: {
  msg: DiscussionMessageDTO
  depth: number
  onRemove: (msg: DiscussionMessageDTO) => void
  removing: boolean
}) {
  // A message is "removed" when it carries a deletedAt tombstone OR the server nulled its author.
  const removed = !!msg.deletedAt || msg.author === null
  const authorName = msg.author?.displayName ?? "Removed"
  const handle = msg.author?.handle
  const reactions = msg.reactions.filter((r) => r.count > 0)

  return (
    <div
      className={`dsc-msg ${removed ? "removed" : ""}`}
      style={depth > 0 ? { marginLeft: depth * 22 } : undefined}
    >
      <span className="dsc-msg-av" aria-hidden="true">
        {removed ? <Icons.Trash size={13} /> : initials(authorName)}
      </span>
      <div className="dsc-msg-body">
        <div className="dsc-msg-top">
          <span className="dsc-msg-who">{authorName}</span>
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

        {/* Attachment thumbnails (skip on a removed message — its media is gone too). */}
        {!removed && msg.attachments.length > 0 && (
          <div className="dsc-msg-media">
            {msg.attachments.map((m) => {
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
          {/* Reaction summary (name + count per non-empty bucket). */}
          {reactions.length > 0 && (
            <span className="dsc-msg-reactions">
              {reactions.map((r) => (
                <span key={r.emoji} className={`dsc-reaction ${r.mine ? "mine" : ""}`}>
                  {REACTION_LABEL[r.emoji] ?? r.emoji} {r.count}
                </span>
              ))}
            </span>
          )}
          {msg.replyCount > 0 && (
            <span className="dsc-msg-replies">
              <Icons.MessageSquare size={11} /> {pluralize(msg.replyCount, "reply", "replies")}
            </span>
          )}
          <div className="spacer" />
          {/* Remove is shown only for live messages — an already-removed message has no action. */}
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
 * The report's PUBLIC discussion — clearly separate from the status timeline above. The status timeline
 * is the operator/system action log (setReportStatus + sendReportFollowup); THIS is the neighbors' public
 * comment thread (read + soft-remove only — operators never post here).
 *
 * Replies render indented under their parent: the flat page is grouped into top-level messages, each
 * followed by its replies (matched on `parentId`). Soft-removed messages stay visible as tombstones so
 * an operator can see what was taken down. Remove calls removeDiscussionMessage with an optional reason
 * collected via a prompt, then invalidates the discussion query (the message re-renders as a tombstone).
 */
function ReportDiscussion({ reportId }: { reportId: string }) {
  const q = useReportDiscussion(reportId)
  const removeMsg = useRemoveDiscussionMessage()
  const toast = useToast()

  const onRemove = (msg: DiscussionMessageDTO) => {
    // Optional audited removal reason (mirrors the moderation remove-action shape).
    const reason = typeof window !== "undefined" ? window.prompt("Reason for removal (optional):") : null
    // A cancelled prompt returns null — treat it as "abort", an empty string as "no reason given".
    if (reason === null && typeof window !== "undefined") return
    removeMsg.mutate(
      { id: reportId, messageId: msg.id, ...(reason ? { reason } : {}) },
      { onSuccess: () => toast("Message removed") },
    )
  }

  return (
    <div className="sub">
      <div className="sub-head">
        Discussion
        {!q.isLoading && !q.isError && (
          <span className="rep-confirms" style={{ marginLeft: "auto" }}>
            <Icons.MessageSquare size={12} /> {q.data?.items.length ?? 0}
          </span>
        )}
      </div>
      <div className="sub-body">
        {q.isLoading ? (
          <LoadingState label="Loading discussion..." />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : (q.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No discussion yet"
            sub="Public comments neighbors leave on this report appear here."
            icon={<Icons.MessageSquare size={20} />}
          />
        ) : (
          <div className="dsc-list">
            {(() => {
              const items = q.data!.items
              // Group into top-level messages then their replies (one level of nesting, matched on
              // parentId). Replies whose parent is absent from this page render as top-level fallbacks.
              const byParent = new Map<string, DiscussionMessageDTO[]>()
              for (const m of items) {
                if (m.parentId) {
                  const arr = byParent.get(m.parentId) ?? []
                  arr.push(m)
                  byParent.set(m.parentId, arr)
                }
              }
              const seen = new Set<string>()
              const rows: React.ReactNode[] = []
              const push = (m: DiscussionMessageDTO, depth: number) => {
                if (seen.has(m.id)) return
                seen.add(m.id)
                rows.push(
                  <DiscussionMessageRow
                    key={m.id}
                    msg={m}
                    depth={depth}
                    onRemove={onRemove}
                    removing={removeMsg.isPending}
                  />,
                )
                for (const reply of byParent.get(m.id) ?? []) push(reply, depth + 1)
              }
              for (const m of items) {
                if (!m.parentId) push(m, 0)
              }
              // Any reply whose parent is off-page: render it at the top level so nothing is dropped.
              for (const m of items) push(m, 0)
              return rows
            })()}
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
  // Stable setter from the parent (React.useState's dispatcher keeps identity), so memoized rows
  // only re-render when their own `item`/`selected` actually change — not on every keystroke.
  onSelect: (id: string) => void
}) {
  const view = reportStatusView(item.status)
  const pin = catPinSrc(item.category)
  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={() => onSelect(item.id)}>
      <div className="leading has-pin" title={REPORT_CATEGORY_LABELS[item.category]}>
        {pin ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pin} alt="" />
        ) : (
          <Icons.Layers size={16} />
        )}
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
          <span>{firstName(item.reporter.name)}</span>
          <span className="sep">·</span>
          <span>{pluralize(item.confirmations, "confirm")}</span>
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
  // "Approve & send to jurisdiction" composer: collapsed until opened. The target address is seeded from
  // the resolved city contact but editable (the per-report one-off override); the note is optional.
  const [routeOpen, setRouteOpen] = React.useState(false)
  const [routeTo, setRouteTo] = React.useState("")
  const [routeNote, setRouteNote] = React.useState("")

  if (q.isLoading) return <LoadingState label="Loading report..." />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const report = q.data
  if (!report) return null

  const view = reportStatusView(report.status)
  // noUncheckedIndexedAccess makes a Record lookup `T | undefined`; fall back to "not sent" so an
  // unexpected/forward-compat status never crashes the detail pane.
  const outreachView = OUTREACH_VIEW[report.outreach.status] ?? OUTREACH_VIEW.not_sent
  const OutreachIco = outreachView.icon
  const canCity = !!report.city.contact
  // A follow-up to the reporter needs a reporter account to notify. An anonymous report has none (the API
  // rejects it with a 422), so the "Reporter" tab is gated exactly like "City" — issue #12.
  const canReporter = !!report.reporter.id
  // Never target a channel that doesn't exist: if "reporter" is selected but unreachable, fall back to city.
  const target: "reporter" | "city" = to === "reporter" && !canReporter ? "city" : to
  const canSend = target === "reporter" ? canReporter : canCity
  const pin = catPinSrc(report.category)
  // The best still to show in the 116px box. media now carries presigned, browser-loadable URLs: prefer the
  // first image (thumb over full), else a video's poster thumbnail. A video with no generated poster has no
  // image to render, so we leave photoUrl null and fall back to the category-pin placeholder rather than
  // putting a video URL in an <img>. Null -> placeholder.
  const previewMedia = report.media.find((m) => m.kind === "image") ?? report.media[0]
  const photoUrl = previewMedia
    ? previewMedia.kind === "image"
      ? (previewMedia.thumbUrl ?? previewMedia.url)
      : (previewMedia.thumbUrl ?? null)
    : null

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

  // Open the approve-&-send composer, seeding the target address from the resolved city contact (the
  // operator can edit it to a one-off override). Re-seeding each open keeps it in sync with the contact.
  const openRoute = () => {
    setRouteTo(report.city.contact ?? "")
    setRouteNote("")
    setRouteOpen(true)
  }

  const sendToJurisdiction = () => {
    const toAddr = routeTo.trim()
    if (!toAddr || route.isPending) return
    const note = routeNote.trim()
    route.mutate(
      {
        id: report.id,
        // Send the typed address as the per-report override only when it differs from the resolved
        // contact; otherwise let the backend use the resolved contact (override stays null).
        ...(toAddr !== (report.city.contact ?? "") ? { contactEmailOverride: toAddr } : {}),
        ...(note ? { note } : {}),
      },
      {
        onSuccess: () => {
          setRouteOpen(false)
          setRouteNote("")
          toast("Sent to jurisdiction")
        },
      },
    )
  }

  const onStatus = (status: AdminReportStatus) => {
    // The quick-status buttons act on BUCKETS, not raw statuses: a `published` report is already in the
    // Submitted bucket, so clicking "Submitted" is a no-op rather than a downgrade to literal `submitted`.
    if (reportBucket(report.status) === reportBucket(status)) return
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

  const onRemove = () => {
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

  const onVerdict = (v: "approved" | "rejected") => {
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
      {/* Header */}
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
        {/* The outreach (email-to-jurisdiction) lifecycle chip, alongside the civic status pill. */}
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
          {/* Description */}
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

          {/* Photo + location */}
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
                  <div className="rep-photo" style={{ ["--cat" as string]: catColor(report.category) }}>
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="rep-photo-img" src={photoUrl} alt="Reporter photo" />
                    ) : (
                      <span className="rep-photo-pin" style={{ background: catColor(report.category) }}>
                        {pin ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pin} alt="" />
                        ) : (
                          <Icons.Layers size={14} />
                        )}
                      </span>
                    )}
                    <span className="rep-photo-tag">
                      <Icons.Eye size={12} /> Reporter photo
                    </span>
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

          {/* Full media gallery — every photo/video on the report so the operator can review them all
              before giving a verdict (the Location box above shows only the lead still). */}
          {report.media.length > 0 && (
            <div className="sub">
              <div className="sub-head">
                Photos
                <span className="rep-confirms" style={{ marginLeft: "auto" }}>
                  <Icons.Eye size={12} /> {report.media.length}
                </span>
              </div>
              <div className="sub-body" style={{ padding: 10 }}>
                <div className="dsc-msg-media">
                  {report.media.map((m) => {
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

          {/* Activity timeline */}
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

          {/* Linked events — the cleanup events that will handle this report. Only rendered when the
              report is linked to at least one event. */}
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

          {/* Public discussion — the neighbors' comment thread. Distinct from the Activity timeline
              above (operator/system actions): this is read + soft-remove only. */}
          <ReportDiscussion reportId={report.id} />
        </div>

        <div className="rep-col">
          {/* Reporter */}
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
              <button className="btn sm ghost full" onClick={() => nav("users", report.reporter.id)}>
                View full account →
              </button>
            </div>
          </div>

          {/* Routed city / department */}
          <div className="sub">
            <div className="sub-head">
              Routed to
              {report.geoid && (
                // Deep-link to the report's jurisdiction row (to edit its routing contact). Only when the
                // report actually resolved to a GEOID; otherwise there is no directory row to open.
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

              {/* Outreach state: the email lifecycle + a link into the per-report city conversation. */}
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

          {/* Report verification — operator verdict (Approve/Reject), orthogonal to the civic status. An
              approved verdict can earn the reporter the report-verified trust state. */}
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

          {/* Approve & send to jurisdiction — emails the full report packet (photos attached) to the
              jurisdiction contact and opens a per-report thread so the city's reply routes back here. */}
          <div className="sub">
            <div className="sub-head">Send to jurisdiction</div>
            <div className="sub-body">
              {!routeOpen ? (
                <>
                  <button className="btn primary full" onClick={openRoute}>
                    <Icons.Send size={13} /> Approve &amp; send to jurisdiction
                  </button>
                  {report.geoid === null && (
                    <div className="hint" style={{ marginTop: 8 }}>
                      No jurisdiction resolved for this report — set a contact in Jurisdictions, or type a
                      one-off address below.
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="field" style={{ marginTop: 0 }}>
                    <label className="eyebrow">Send to</label>
                    <input
                      type="email"
                      placeholder="contact@city.gov"
                      value={routeTo}
                      onChange={(e) => setRouteTo(e.target.value)}
                    />
                  </div>
                  {report.geoid === null && (
                    <div className="hint" style={{ marginTop: 4 }}>
                      No jurisdiction on file — this is a one-off address for THIS report. Add a permanent
                      contact in Jurisdictions to route future reports automatically.
                    </div>
                  )}
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
                      disabled={!routeTo.trim() || route.isPending}
                      onClick={sendToJurisdiction}
                      style={
                        !routeTo.trim() ? { opacity: 0.45, cursor: "not-allowed" } : undefined
                      }
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

          {/* Follow-up composer */}
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

      {/* Action bar */}
      <div className="rep-actions">
        <span className="rep-actions-label">Quick status</span>
        {STATUS_ACTIONS.map((s) => {
          // Active when the report's CURRENT status shares this button's bucket (so a `published` report
          // shows "Submitted" as the active step, not nothing).
          const active = reportBucket(report.status) === reportBucket(s.value)
          return (
            <button
              key={s.value}
              className={`btn sm ${active ? "primary" : ""}`}
              disabled={setStatus.isPending}
              onClick={() => onStatus(s.value)}
            >
              {active && <Icons.Check size={11} />}
              {s.label}
            </button>
          )
        })}
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
  const [filter, setFilter] = React.useState("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const listParams = {
    filter:
      filter === "all"
        ? undefined
        : (filter as "submitted" | "in_progress" | "completed" | "flagged"),
    q: query.trim() || undefined,
  }
  const listQuery = useReportList(listParams)
  const items = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data])

  // Chip counts come from the SERVER (response.counts): accurate per-bucket totals over the searched set,
  // not capped to the first keyset page and stable as the status facet changes. The backend buckets
  // published/held as Submitted (a live pin), matching the pills. Falls back to zeros pre-load.
  const counts = listQuery.data?.counts ?? {
    all: 0,
    submitted: 0,
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

  // After a removal, drop the selection so the effect re-selects the first remaining row.
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
          onChange={setFilter}
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
            <span className="meta">{items.length}</span>
          </div>
          <div className="queue-list">
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
              items.map((r) => (
                // Pass the stable `setSelId` dispatcher (not a fresh arrow) so memoized rows don't
                // all re-render on each parent render; the row calls onSelect(item.id) on click.
                <ReportRow key={r.id} item={r} selected={selId === r.id} onSelect={setSelId} />
              ))
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

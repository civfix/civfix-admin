"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import {
  ADMIN_REPORT_STATUS_LABELS,
  ADMIN_REPORT_STATUS_TRANSITIONS,
  MESSAGE_BODY_MAX,
  REPORT_CATEGORY_LABELS,
  RouteReportRequestSchema,
  SendFollowupRequestSchema,
  type AdminReportCounts,
  type AdminReportDTO,
  type AdminReportListItemDTO,
  type AdminReportStatus,
  type ChatMessageDTO,
  type LinkedEventRef,
  type ReportCategory,
  type ReportOutreachStatus,
} from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog } from "@/components/shared/dialog"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { LightboxSync, openLightbox, type LightboxImage } from "@/components/shared/lightbox"
import { categoryCssVar, categoryPinSrc } from "@/lib/category"
import { reportStatusView } from "@/lib/report-status"
import { eventKindView } from "@/lib/event-kind"
import { getReporterProfileId } from "@/features/reports/reporter-navigation"
import { pluralize } from "@/features/reports/plural"
import {
  msgWhen,
  reactionLabel,
  sortChatOldestFirst,
  systemLabel,
} from "@/features/reports/report-chat"
import { reportMediaView } from "@/features/reports/report-media"
import { sendPanelView } from "@/features/reports/send-panel"
import { SubmitShortcutHint, SUBMIT_KEYSHORTCUTS } from "@/features/reports/submit-shortcut"
import { useDebounced } from "@/hooks/use-debounced"
import {
  useFlagReport,
  useRemoveReport,
  useRemoveReportMessage,
  useReport,
  useRefreshReportMedia,
  useReportChatHistory,
  useReportListInfinite,
  useRouteReport,
  useSendReportFollowup,
  useSendReportMessage,
  useSetReportStatus,
  useSetReportVerdict,
} from "@/features/reports/use-reports"
import { useNav, useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"


const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="pi-map-canvas" aria-busy="true" />,
})

const ROUTE_NOTE_MAX = RouteReportRequestSchema.shape.note.unwrap().maxLength ?? undefined
const FOLLOWUP_MAX = SendFollowupRequestSchema.shape.body.maxLength ?? undefined

type ReportFilter = "needs_verification" | "in_progress" | "completed" | "flagged" | "all"

const FILTER_COUNT_KEY: Record<ReportFilter, keyof AdminReportCounts> = {
  needs_verification: "needsVerification",
  in_progress: "in_progress",
  completed: "completed",
  flagged: "flagged",
  all: "all",
}

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

function chatAuthorName(msg: ChatMessageDTO): string {
  return msg.from?.name ?? "Removed"
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
  refreshPhotos,
}: {
  msg: ChatMessageDTO
  onRemove: (msg: ChatMessageDTO) => void
  removing: boolean
  nav: ReturnType<typeof useNav>
  refreshPhotos: () => void
}) {
  const removed = !!msg.deletedAt || msg.from == null
  const authorName = chatAuthorName(msg)
  const handle = msg.from?.handle
  const authorId = msg.from?.id
  const reactions = (msg.reactions ?? []).filter((r) => r.count > 0)
  const attachments = msg.attachments ?? []
  const chatImages: LightboxImage[] = attachments
    .filter((m) => m.kind === "image")
    .map((m) => ({ id: m.id, url: m.url, alt: `Photo from ${authorName}` }))

  return (
    <div className={`dsc-msg ${removed ? "removed" : ""}`}>
      <span className="dsc-msg-av" aria-hidden="true">
        {removed ? <Icons.Trash size={13} /> : initials(authorName)}
      </span>
      <div className="dsc-msg-body">
        <div className="dsc-msg-top">
          {authorId && !removed ? (
            <button
              type="button"
              className="dsc-msg-who lnk-inline"
              title={`Open ${authorName}'s profile`}
              onClick={(e) => {
                e.stopPropagation()
                nav("users", authorId)
              }}
            >
              {authorName}
            </button>
          ) : (
            <span className="dsc-msg-who">{authorName}</span>
          )}
          {handle && !removed && <span className="dsc-msg-handle mono">{handle}</span>}
          {msg.from?.official && !removed && (
            <span className="pill status-ok tight" title="The official CivFix account">
              <Icons.Check size={10} /> Official
            </span>
          )}
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
            <LightboxSync images={chatImages} />
            {attachments.map((m) =>
              m.kind === "image" ? (
                <button
                  key={m.id}
                  type="button"
                  className="dsc-msg-thumb dsc-msg-thumb-open"
                  title="Expand this photo"
                  onClick={() =>
                    openLightbox(
                      chatImages,
                      chatImages.findIndex((i) => i.id === m.id),
                      refreshPhotos,
                    )
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.thumbUrl ?? m.url} alt="" loading="lazy" decoding="async" />
                </button>
              ) : (
                <span key={m.id} className="dsc-msg-thumb">
                  {m.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.thumbUrl} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <Icons.FileText size={14} />
                  )}
                </span>
              ),
            )}
          </div>
        )}

        <div className="dsc-msg-foot">
          {reactions.length > 0 && (
            <span className="dsc-msg-reactions">
              {reactions.map((r) => (
                <span key={r.emoji} className={`dsc-reaction ${r.mine ? "mine" : ""}`}>
                  {reactionLabel(r.emoji)} {r.count}
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
 * The report chat as neighbors see it, read through the ADMIN plane, including sender-less SYSTEM status
 * events. Operators moderate here and can post into the same public thread. Remove goes through the
 * admin remove endpoint (soft-delete) and is gated to non-system rows (a status event has no author and
 * can't be removed).
 */
function ReportDiscussion({
  reportId,
  cityDept,
  hasCityContact,
}: {
  reportId: string
  cityDept: string
  hasCityContact: boolean
}) {
  const q = useReportChatHistory(reportId)
  const removeMsg = useRemoveReportMessage()
  const sendMsg = useSendReportMessage()
  const toast = useToast()
  const nav = useNav()
  const [draft, setDraft] = React.useState("")

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

  const onSend = () => {
    const body = draft.trim()
    if (!body || sendMsg.isPending) return
    sendMsg.mutate(
      { id: reportId, body },
      {
        onSuccess: () => {
          setDraft("")
          toast("Message posted to the report chat")
        },
      },
    )
  }

  // Oldest first, matching the order neighbors see in the chat.
  const items = React.useMemo(
    () => sortChatOldestFirst(q.data?.pages.flatMap((p) => p.items) ?? []),
    [q.data],
  )

  return (
    <div className="sub">
      <div className="sub-head">
        Chat
        {!q.isLoading && !q.isError && (
          <span className="rep-confirms" style={{ marginLeft: "auto" }}>
            <Icons.MessageSquare size={12} /> {items.length}
            {q.hasNextPage ? "+" : ""}
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
            {q.hasNextPage && (
              <button
                type="button"
                className="btn sm ghost full"
                disabled={q.isFetchingNextPage}
                onClick={() => q.fetchNextPage()}
              >
                {q.isFetchingNextPage ? "Loading…" : "Load older messages"}
              </button>
            )}
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
                  refreshPhotos={() => void q.refetch()}
                />
              ),
            )}
          </div>
        )}
      </div>
      <div className="dsc-composer">
        <textarea
          className="rep-followup"
          rows={3}
          maxLength={MESSAGE_BODY_MAX}
          placeholder="Message the neighbors as CivFix…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSend()
          }}
          aria-label="Message the report chat"
          aria-keyshortcuts={SUBMIT_KEYSHORTCUTS}
        />
        <div className="dsc-composer-foot">
          {hasCityContact && (
            <span className="hint">
              Tagging the city&apos;s @handle forwards this message to {cityDept} by email.
            </span>
          )}
          <div className="spacer" />
          <button
            className={`btn ${draft.trim() ? "primary" : ""}`}
            disabled={!draft.trim() || sendMsg.isPending}
            style={!draft.trim() ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
            onClick={onSend}
          >
            <Icons.Send size={13} /> Post <SubmitShortcutHint />
          </button>
        </div>
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
  const [brokenThumb, setBrokenThumb] = React.useState<string | null>(null)
  const thumb = item.thumbnailUrl !== brokenThumb ? item.thumbnailUrl : null
  const categoryLabel = REPORT_CATEGORY_LABELS[item.category]
  return (
    <div
      className={`qrow ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(item.id)}
      onKeyDown={(e) => {
        // A key pressed on the nested reporter link bubbles here; it must stay that link's activation.
        if (e.target !== e.currentTarget || !isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        onSelect(item.id)
      }}
    >
      <div
        className={`leading ${thumb ? "has-thumb" : "has-pin"}`}
        style={{ ["--cat" as string]: categoryCssVar(item.category) }}
        role="img"
        aria-label={categoryLabel}
        title={categoryLabel}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBrokenThumb(thumb)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={categoryPinSrc(item.category)} alt="" loading="lazy" decoding="async" />
        )}
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{item.title}</span>
          {item.flagged && (
            <span className="rep-flag-dot" role="img" aria-label="Flagged" title="Flagged">
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

function ReportPhotoFace({
  photoUrl,
  pin,
  category,
}: {
  photoUrl: string | null
  pin: string
  category: ReportCategory
}) {
  return (
    <>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="rep-photo-img" src={photoUrl} alt="Reporter photo" decoding="async" />
      ) : (
        <span className="rep-photo-pin" style={{ background: categoryCssVar(category) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pin} alt="" />
        </span>
      )}
      {photoUrl && (
        <span className="rep-photo-tag">
          <Icons.Eye size={12} /> Reporter photo
        </span>
      )}
    </>
  )
}

function ReportDetail({ reportId, onRemoved }: { reportId: string; onRemoved: (id: string) => void }) {
  const q = useReport(reportId)
  const nav = useNav()
  const toast = useToast()
  const refreshMedia = useRefreshReportMedia(reportId)

  const setStatus = useSetReportStatus()
  const flag = useFlagReport()
  const remove = useRemoveReport()
  const followup = useSendReportFollowup()
  const route = useRouteReport()
  const verdict = useSetReportVerdict()

  const [text, setText] = React.useState("")
  const [routeOpen, setRouteOpen] = React.useState(false)
  const [routeNote, setRouteNote] = React.useState("")
  const [approvedLocally, setApprovedLocally] = React.useState(false)
  const routeBlockedId = React.useId()
  const rejectBlockedId = React.useId()
  const followupBlockedId = React.useId()

  if (q.isLoading) return <LoadingState label="Loading report..." />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const report = q.data
  if (!report) return null

  const view = reportStatusView(report.status)
  const outreachView = OUTREACH_VIEW[report.outreach.status] ?? OUTREACH_VIEW.not_sent
  const OutreachIco = outreachView.icon
  const canCity = !!report.city.contact
  const panel = sendPanelView(report, approvedLocally)
  // A status newer than this build arrives unvalidated; offer no transition rather than guess one.
  const statusActions = ADMIN_REPORT_STATUS_TRANSITIONS[report.status] ?? []
  const reporterProfileId = getReporterProfileId(report.reporter.id)
  const { routeAction, approvesOnSend, canApproveHere, followupBlocked } = panel
  const sendAttempted = report.outreach.routedAt !== null
  const canSend = followupBlocked === null
  const pin = categoryPinSrc(report.category)
  const { preview, gallery: galleryMedia, lightboxImages } = reportMediaView(report.media, report.title)
  const photoUrl = preview ? (preview.thumbUrl ?? preview.url) : null
  const lightboxIndex = (id: string) => lightboxImages.findIndex((i) => i.id === id)

  const send = () => {
    const body = text.trim()
    if (!body || !canSend) return
    followup.mutate(
      { id: report.id, to: "city", body },
      {
        onSuccess: () => {
          setText("")
          toast("Follow-up sent to city")
        },
      },
    )
  }

  const openRoute = () => {
    setRouteNote("")
    setRouteOpen(true)
  }

  // Awaited rather than chained through per-call callbacks: those are dropped once the operator opens
  // another report (this pane remounts), which would leave a report approved but never sent.
  const routeToJurisdiction = async (note: string) => {
    const res = await route.mutateAsync({ id: report.id, ...(note ? { note } : {}) })
    setRouteOpen(false)
    setRouteNote("")
    toast(`Sent to ${res.routedTo}`)
  }

  const sendToJurisdiction = async () => {
    const contact = report.city.contact
    if (!contact || route.isPending || verdict.isPending) return
    const note = routeNote.trim()
    const ok = await confirmDialog({
      title: approvesOnSend ? "Verify and send to the city?" : "Send to the city?",
      body: approvesOnSend
        ? `This approves this report's verification. It emails the report and its attached photos to ${contact}. Once this reporter has two approved reports, their account is marked report-verified.`
        : `This emails the report and its attached photos to ${contact}.`,
      confirmLabel: approvesOnSend ? "Verify and send" : "Send",
    })
    if (!ok) return
    try {
      if (approvesOnSend) {
        await verdict.mutateAsync({ id: report.id, verdict: "approved" })
        setApprovedLocally(true)
      }
      await routeToJurisdiction(note)
    } catch {
      // The query client already toasted the failure; a failed approve must stop before the send.
    }
  }

  const onApprove = async () => {
    if (verdict.isPending) return
    const ok = await confirmDialog({
      title: "Approve report",
      body: [
        "This approves this report's verification.",
        sendAttempted ? null : "It is not sent to the city.",
        "Once this reporter has two approved reports, their account is marked report-verified.",
      ]
        .filter((line): line is string => line !== null)
        .join(" "),
      confirmLabel: "Approve",
    })
    if (!ok) return
    verdict.mutate(
      { id: report.id, verdict: "approved" },
      {
        onSuccess: () => {
          setApprovedLocally(true)
          toast(`${shortId(report.id)} · approved`)
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
        // The endpoint toggles, so another operator's flag since this load flips the outcome: word the
        // toast from the report as it now is.
        onSuccess: async () => {
          const { data } = await q.refetch()
          toast(
            data?.flagged
              ? `${shortId(report.id)} · flagged for review`
              : `${shortId(report.id)} · flag cleared`,
          )
        },
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

  const onReject = async () => {
    const ok = await confirmDialog({
      title: "Reject report",
      body: sendAttempted
        ? "This rejects the report's verification verdict. It was already emailed to the city — rejecting does not recall that email."
        : "This rejects the report's verification verdict. It is not sent to the city.",
      danger: true,
      confirmLabel: "Reject",
    })
    if (!ok) return
    verdict.mutate(
      { id: report.id, verdict: "rejected" },
      {
        onSuccess: () => {
          setApprovedLocally(false)
          toast(`${shortId(report.id)} · rejected`)
        },
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
                <LightboxSync images={lightboxImages} />
                {report.hasPhoto &&
                  (preview ? (
                    <button
                      type="button"
                      className="rep-photo rep-photo-open"
                      style={{ ["--cat" as string]: categoryCssVar(report.category) }}
                      title="Expand this photo"
                      onClick={() =>
                        openLightbox(lightboxImages, lightboxIndex(preview.id), refreshMedia)
                      }
                    >
                      <ReportPhotoFace
                        photoUrl={photoUrl}
                        pin={pin}
                        category={report.category}
                      />
                    </button>
                  ) : (
                    <div
                      className="rep-photo"
                      style={{ ["--cat" as string]: categoryCssVar(report.category) }}
                    >
                      <ReportPhotoFace
                        photoUrl={photoUrl}
                        pin={pin}
                        category={report.category}
                      />
                    </div>
                  ))}
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
                  {galleryMedia.map((m) =>
                    m.kind === "image" ? (
                      <button
                        key={m.id}
                        type="button"
                        className="dsc-msg-thumb dsc-msg-thumb-open"
                        title="Expand this photo"
                        onClick={() =>
                          openLightbox(lightboxImages, lightboxIndex(m.id), refreshMedia)
                        }
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.thumbUrl ?? m.url} alt="" loading="lazy" decoding="async" />
                      </button>
                    ) : (
                      <a
                        key={m.id}
                        className="dsc-msg-thumb"
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open full media in a new tab"
                      >
                        {m.thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.thumbUrl} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <Icons.FileText size={14} />
                        )}
                      </a>
                    ),
                  )}
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
          <ReportDiscussion
            reportId={report.id}
            cityDept={report.city.dept}
            hasCityContact={canCity}
          />
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
              Send to jurisdiction
              <span className={`pill tight ${panel.verdictPill.cls}`} style={{ marginLeft: "auto" }}>
                {panel.verdictPill.label}
              </span>
            </div>
            <div className="sub-body">
              <div className="rep-loc" style={{ marginBottom: 8 }}>
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
                    disabled={panel.routeBlocked !== null}
                    aria-describedby={panel.routeBlocked ? routeBlockedId : undefined}
                    style={panel.routeBlocked ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
                    onClick={openRoute}
                  >
                    <Icons.Send size={13} /> {panel.routeLabel}
                  </button>
                  {panel.routeBlocked && (
                    <div id={routeBlockedId} className="hint">
                      {panel.routeBlocked}
                    </div>
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
                    aria-label="Note to include in the email"
                    maxLength={ROUTE_NOTE_MAX}
                    value={routeNote}
                    onChange={(e) => setRouteNote(e.target.value)}
                  />
                  <div className="rep-to" style={{ marginTop: 8 }}>
                    <button
                      className="btn primary full"
                      disabled={route.isPending || verdict.isPending}
                      onClick={sendToJurisdiction}
                    >
                      <Icons.Send size={13} /> {panel.routeLabel}
                    </button>
                    <button
                      className="btn"
                      disabled={route.isPending || verdict.isPending}
                      onClick={() => setRouteOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
              <div className="rep-to" style={{ marginTop: 8 }}>
                {canApproveHere && (
                  <button
                    className="btn success sm full"
                    disabled={verdict.isPending}
                    onClick={onApprove}
                    title="Approve this report's verification without sending it to the city"
                  >
                    <Icons.Check size={12} /> Approve
                  </button>
                )}
                <button
                  className="btn danger sm full"
                  disabled={verdict.isPending || panel.rejectBlocked !== null}
                  aria-describedby={panel.rejectBlocked ? rejectBlockedId : undefined}
                  onClick={onReject}
                  title="Reject this report's verification instead of sending it"
                >
                  <Icons.X size={12} /> Reject
                </button>
              </div>
              {panel.rejectBlocked && (
                <div id={rejectBlockedId} className="hint">
                  {panel.rejectBlocked}
                </div>
              )}
            </div>
          </div>

          { }
          <div className="sub">
            <div className="sub-head">Message the city</div>
            <div className="sub-body">
              <div className="rep-city-contact">
                <Icons.Building size={12} />
                <span>{report.city.dept}</span>
              </div>
              <textarea
                className="rep-followup"
                style={{ marginTop: 8 }}
                rows={3}
                placeholder={`Message ${report.city.dept} — e.g. nudge for an update…`}
                aria-label="Message to the city"
                maxLength={FOLLOWUP_MAX}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                className="btn primary full"
                disabled={!text.trim() || !canSend || followup.isPending}
                aria-describedby={followupBlocked ? followupBlockedId : undefined}
                onClick={send}
                style={!text.trim() || !canSend ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              >
                <Icons.Send size={13} /> Send to city
              </button>
              {followupBlocked && (
                <div id={followupBlockedId} className="hint">
                  {followupBlocked}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      { }
      <div className="rep-actions">
        <span className="rep-actions-label">Quick status</span>
        {statusActions.length === 0 ? (
          <span className="hint">
            No status changes from {ADMIN_REPORT_STATUS_LABELS[report.status] ?? report.status}
          </span>
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
  const [filter, setFilter] = React.useState<ReportFilter>("needs_verification")
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
  const listCount = serverCounts ? (serverCounts[FILTER_COUNT_KEY[filter]] ?? 0) : items.length

  // Row 0 is picked once, on the first load. After an action clears the selection the list is still the
  // pre-action page, so picking again would put another report's live buttons under the cursor.
  const autoPicked = React.useRef(false)
  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (selId !== null) autoPicked.current = true
    else if (!autoPicked.current && items.length) {
      autoPicked.current = true
      setSelId(items[0]!.id)
    }
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
            Every report neighbors submit — verified, then routed to the right city department. Track
            status, follow up with the city, and close the loop.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={[
            {
              value: "needs_verification",
              label: "Needs verification",
              count: counts.needsVerification ?? 0,
            },
            { value: "in_progress", label: "In progress", count: counts.in_progress },
            { value: "completed", label: "Completed", count: counts.completed },
            { value: "flagged", label: "Flagged", count: counts.flagged },
            { value: "all", label: "All", count: counts.all },
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
            aria-label="Search reports"
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
                  {selId === focusId ? "Linked report" : "Selected report"}
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

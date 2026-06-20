"use client"

import * as React from "react"
import {
  MAIL_STATUS_LABELS,
  relativeAgo,
  type MailStatus,
  type MailThreadDTO,
  type MailThreadListItemDTO,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import {
  useComposeMail,
  useMailList,
  useMailStats,
  useMailThread,
  useMarkMailRead,
  useReplyMail,
  useResendMail,
  useSetMailStatus,
} from "@/features/mail/use-mail"
import { useInboxList, useSetInboxStatus } from "@/features/inbox/use-inbox"
import { InboxRow, InboxReader } from "@/features/inbox/inbox-views"
import { useNav, useToast } from "@/store/ui-store"
import { errorMessage } from "@/lib/error-messages"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Mail — the unified mailbox. Consolidates what used to be two separate sections ("Mail" + "Inbox") into
 * ONE screen with a mail-client folder switch:
 *   • Outreach — two-way threads with municipal contacts (compose / reply / resend / deliverability),
 *     backed by GET /admin/mail (threaded, repliable).
 *   • Inbox    — catch-all *@civfix.org mail that is not an outreach reply (support@, cold inbound),
 *     backed by GET /admin/inbox (flat single messages, triage-only: mark read / archive).
 *
 * The two are genuinely different data models (threads vs single messages), so each folder keeps its own
 * typed endpoints, list, reader, and actions — but they share one master-detail shell + CSS. The folder
 * switch is the primary control; the status chips and the deliverability strip are contextual to it.
 *
 * Deep-links: a focusId of "inbox:<id>" opens the Inbox folder on that message; a bare "<id>" opens an
 * outreach thread (see parseFocus + the home Mail tile, which prefixes inbox rows).
 */

type Folder = "outreach" | "inbox"

/** The needs-attention outreach statuses (the design's {needs-action, bounced}). */
const ATTENTION: MailStatus[] = ["needs_action", "bounced"]

/** Pill treatment per outreach status (matches the design's MAIL_STATUS class mapping). */
const STATUS_CLS: Record<MailStatus, string> = {
  replied: "status-ok",
  delivered: "status-ok",
  auto: "status-progress",
  opened: "status-progress",
  sent: "status-progress",
  needs_action: "status-flag",
  bounced: "status-flag",
}

/** The thread-list card title per selected outreach box / inbox box. */
const BOX_LABEL: Record<string, string> = {
  all: "All",
  in: "Inbound",
  out: "Outbound",
  attn: "Needs attention",
  unread: "Unread",
  archived: "Archived",
}

/** Decode a shell focusId into the folder it targets + the bare entry id. */
function parseFocus(focusId: string | null): { folder: Folder; id: string | null } {
  if (!focusId) return { folder: "outreach", id: null }
  if (focusId.startsWith("inbox:")) return { folder: "inbox", id: focusId.slice("inbox:".length) }
  return { folder: "outreach", id: focusId }
}

/** Pill treatment per sending-domain health status (shares the status-* pill classes). */
const DOMAIN_HEALTH_CLS: Record<"ok" | "warn" | "bad", string> = {
  ok: "status-ok",
  warn: "status-progress",
  bad: "status-flag",
}

/** Compact relative "ago" label ("3h"/"2d") for a list/row timestamp; "" for an empty/bad ts. */
function ts(value: string): string {
  return relativeAgo(value)
}

/** The full absolute date for a timestamp's hover title (empty for a missing/bad ts). */
function tsTitle(value: string): string {
  if (!value) return ""
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString()
}

/** A whole-number percent from a 0-1 deliverability fraction (e.g. 0.95 -> "95"). */
function pct(fraction: number, digits = 0): string {
  return (fraction * 100).toFixed(digits)
}

/**
 * Resolve the human correspondent for a thread reader — the municipal party, never our own outreach
 * address. Prefer the latest INBOUND message's sender; for an outbound-only thread (compose / resend
 * with no reply yet) fall back to the latest OUTBOUND message's recipient (`to`), then the thread-level
 * `to`, then a placeholder.
 */
function correspondent(sel: MailThreadDTO): string {
  for (let i = sel.messages.length - 1; i >= 0; i--) {
    const m = sel.messages[i]!
    if (m.dir === "in" && m.from) return m.from
  }
  for (let i = sel.messages.length - 1; i >= 0; i--) {
    const m = sel.messages[i]!
    if (m.dir === "out" && m.to) return m.to
  }
  return sel.to || "—"
}

function ComposeModal({
  open,
  onClose,
  onSend,
  pending,
}: {
  open: boolean
  onClose: () => void
  onSend: (input: { to: string; subject: string; body: string }) => void
  pending: boolean
}) {
  const [to, setTo] = React.useState("")
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")

  React.useEffect(() => {
    if (open) {
      setTo("")
      setSubject("")
      setBody("")
    }
  }, [open])

  if (!open) return null
  const canSend = !!to.trim() && !!subject.trim() && !!body.trim() && !pending

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal compose-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>New message</h3>
          <button className="closebtn" onClick={onClose}>
            <Icons.X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="compose-field">
            <label>To</label>
            <input
              type="email"
              placeholder="contact@city.gov"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              autoFocus
            />
          </div>
          <div className="compose-field">
            <label>Subject</label>
            <input
              type="text"
              placeholder="Subject line"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="compose-field">
            <label>Message</label>
            <textarea
              rows={7}
              placeholder="Write your message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-foot">
          <span className="compose-from">
            From <span className="mono">outreach@civfix.org</span>
          </span>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn ${canSend ? "primary" : ""}`}
            disabled={!canSend}
            style={!canSend ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
            onClick={() => onSend({ to: to.trim(), subject: subject.trim(), body: body.trim() })}
          >
            <Icons.Send size={13} /> Send
          </button>
        </div>
      </div>
    </div>
  )
}

function MailRow({
  item,
  selected,
  onClick,
}: {
  item: MailThreadListItemDTO
  selected: boolean
  onClick: () => void
}) {
  return (
    <div
      className={`mail-row ${selected ? "selected" : ""} ${item.unread ? "unread" : ""}`}
      onClick={onClick}
    >
      <span className={`mail-dir ${item.dir}`}>
        {item.dir === "in" ? <Icons.ArrowDown size={13} /> : <Icons.ArrowUp size={13} />}
      </span>
      <div className="mail-row-body">
        <div className="mail-row-top">
          <span className="mail-from">
            {item.org ||
              (item.dir === "in"
                ? item.from || "(no sender)"
                : item.to || "(no recipient)")}
          </span>
          <span className="mail-ts mono" title={tsTitle(item.ts)}>
            {ts(item.ts)}
          </span>
        </div>
        <div className="mail-subject">{item.subject || "(no subject)"}</div>
        <div className="mail-preview">{item.preview}</div>
      </div>
      <span className={`pill ${STATUS_CLS[item.status]} tight mail-status-pill`}>
        {MAIL_STATUS_LABELS[item.status]}
      </span>
    </div>
  )
}

function MailReader({ threadId }: { threadId: string }) {
  const q = useMailThread(threadId)
  const nav = useNav()
  const toast = useToast()

  const reply = useReplyMail()
  const setStatus = useSetMailStatus()
  const resend = useResendMail()

  const [text, setText] = React.useState("")
  const bodyRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setText("")
  }, [threadId])

  if (q.isLoading) return <LoadingState label="Loading thread..." />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const sel = q.data
  if (!sel) return <EmptyState title="No message selected" icon={<Icons.Mail size={20} />} />

  // The municipal party for this thread (recipient or inbound sender) — never our own outreach address,
  // and used for the "To"/confirmation copy (sel.org is empty for a bare composed thread).
  const who = correspondent(sel)
  const whoLabel = sel.org || who

  const sendReply = () => {
    const body = text.trim()
    if (!body) return
    reply.mutate(
      { id: sel.id, body },
      {
        onSuccess: () => {
          setText("")
          toast(`Reply sent to ${whoLabel}`)
          setTimeout(() => {
            if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
          }, 50)
        },
        onError: (err) =>
          toast(errorMessage(err, {}, { fallback: "Couldn't send the reply. Please try again." })),
      },
    )
  }

  const markDone = () => {
    setStatus.mutate(
      { id: sel.id, status: "replied" },
      {
        onSuccess: () => toast("Marked done"),
        onError: (err) => toast(errorMessage(err, {}, { fallback: "Couldn't update the thread." })),
      },
    )
  }

  const onResend = () => {
    resend.mutate(
      { id: sel.id },
      {
        onSuccess: () => toast("Message resent"),
        onError: (err) => toast(errorMessage(err, {}, { fallback: "Couldn't resend the message." })),
      },
    )
  }

  // Only meaningful when the thread links a jurisdiction — otherwise there is no routing contact to
  // fix, so the button is hidden (see the bounced footer) and this never fires without a geoid.
  const onFixRouting = () => {
    if (sel.jurisdictionGeoid) nav("discovery", sel.jurisdictionGeoid)
  }

  return (
    <div className="mail-reader">
      <div className="mail-reader-head">
        <div className="mail-reader-subj">{sel.subject || "(no subject)"}</div>
        <div className="mail-reader-meta">
          <span className={`mail-dir ${sel.dir}`}>
            {sel.dir === "in" ? <Icons.ArrowDown size={12} /> : <Icons.ArrowUp size={12} />}
          </span>
          <span className="mono">{who}</span>
          {sel.org && (
            <>
              <span className="sep">·</span>
              <span>{sel.org}</span>
            </>
          )}
          <span className="spacer" />
          <span className={`pill ${STATUS_CLS[sel.status]} tight`}>
            {MAIL_STATUS_LABELS[sel.status]}
          </span>
        </div>
      </div>

      <div className="mail-reader-body" ref={bodyRef}>
        <div className="mail-thread">
          {sel.messages.map((msg) => {
            const isOut = msg.dir === "out"
            // Show the party each message concerns: the recipient on our outbound, the sender inbound.
            const addr = isOut ? (msg.to ? `to ${msg.to}` : "") : msg.from
            return (
              <div key={msg.id} className={`mail-msg ${isOut ? "out" : "in"}`}>
                <div className="mail-msg-head">
                  <span className="mail-msg-who">{msg.who}</span>
                  {addr && <span className="mail-msg-addr mono">{addr}</span>}
                  <span className="spacer" />
                  <span className="mail-msg-ts mono" title={tsTitle(msg.ts)}>
                    {ts(msg.ts)}
                  </span>
                </div>
                <p className="mail-msg-body">{msg.body}</p>
              </div>
            )
          })}
        </div>

        {sel.status === "bounced" && (
          <div className="mail-bounce-note">
            <Icons.AlertTriangle size={14} />
            Hard bounce — the address rejected delivery. Try a different contact or the city&apos;s
            reporting form.
          </div>
        )}
        {sel.dir === "in" && sel.status === "needs_action" && (
          <div className="mail-action-note">
            <Icons.CornerArr size={14} />
            Suggested: re-route this jurisdiction&apos;s contact in Jurisdictions.
          </div>
        )}
      </div>

      {sel.status === "bounced" ? (
        <div className="mail-reader-foot">
          {sel.jurisdictionGeoid && (
            <button className="btn primary" disabled={resend.isPending} onClick={onFixRouting}>
              <Icons.AlertTriangle size={13} /> Fix routing contact
            </button>
          )}
          <button className="btn" disabled={resend.isPending} onClick={onResend}>
            <Icons.Send size={13} /> Resend
          </button>
        </div>
      ) : (
        <div className="mail-composer">
          <textarea
            className="mail-reply-input"
            rows={3}
            placeholder={`Reply to ${sel.org}…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply()
            }}
          />
          <div className="mail-composer-foot">
            <span className="mail-reply-to">
              To <span className="mono">{who}</span>
            </span>
            <div className="spacer" />
            <button className="btn" disabled={setStatus.isPending} onClick={markDone}>
              <Icons.Check size={13} /> Mark done
            </button>
            <button
              className={`btn ${text.trim() ? "primary" : ""}`}
              disabled={!text.trim() || reply.isPending}
              style={!text.trim() ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              onClick={sendReply}
            >
              <Icons.Send size={13} /> Reply <span className="kbdhint">⌘⏎</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function MailPage({ focusId }: SectionPageProps) {
  const initial = parseFocus(focusId)
  const [folder, setFolder] = React.useState<Folder>(initial.folder)
  const [box, setBox] = React.useState("all")
  const [selId, setSelId] = React.useState<string | null>(initial.id)
  const [composeOpen, setComposeOpen] = React.useState(false)
  const outreach = folder === "outreach"

  // Search the active folder's list (backend MailListQuery.q / InboxListQuery.q). Debounced so we
  // don't refetch on every keystroke; the trimmed value flows into the active list query below.
  const [query, setQuery] = React.useState("")
  const [debouncedQuery, setDebouncedQuery] = React.useState("")
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])
  const q = debouncedQuery || undefined

  const toast = useToast()
  const compose = useComposeMail()
  const markRead = useMarkMailRead()
  const setInboxStatus = useSetInboxStatus()

  // Filtered list for the ACTIVE folder; the inactive folder fetches its unfiltered list (which
  // dedupes by query key with the *All queries below, so a folder costs one list fetch + the badges).
  const mailListQuery = useMailList(
    outreach
      ? {
          dir: box === "in" ? ("in" as const) : box === "out" ? ("out" as const) : undefined,
          filter: box === "attn" ? ("attn" as const) : undefined,
          q,
        }
      : {},
  )
  const inboxListQuery = useInboxList(
    !outreach
      ? {
          status:
            box === "unread"
              ? ("unread" as const)
              : box === "archived"
                ? ("archived" as const)
                : ("all" as const),
          q,
        }
      : { status: "all" as const },
  )

  // Unfiltered fetches for stable folder switch + chip counts (independent of the active search/box).
  const mailAllQuery = useMailList({})
  const inboxAllQuery = useInboxList({ status: "all" })
  const mailAllItems = mailAllQuery.data?.items ?? []
  const inboxAllItems = inboxAllQuery.data?.items ?? []
  const mailCounts = {
    all: mailAllItems.length,
    in: mailAllItems.filter((t) => t.dir === "in").length,
    out: mailAllItems.filter((t) => t.dir === "out").length,
    attn: mailAllItems.filter((t) => t.unread || ATTENTION.includes(t.status)).length,
  }
  const inboxCounts = {
    all: inboxAllItems.length,
    unread: inboxAllItems.filter((i) => i.unread).length,
    archived: inboxAllItems.filter((i) => i.status === "archived").length,
  }

  const mailItems = React.useMemo(() => mailListQuery.data?.items ?? [], [mailListQuery.data])
  const inboxItems = React.useMemo(() => inboxListQuery.data?.items ?? [], [inboxListQuery.data])
  const activeListQuery = outreach ? mailListQuery : inboxListQuery
  const activeCount = outreach ? mailItems.length : inboxItems.length
  const activeIds = React.useMemo(
    () => (outreach ? mailItems.map((t) => t.id) : inboxItems.map((i) => i.id)),
    [outreach, mailItems, inboxItems],
  )

  const statsQuery = useMailStats()
  const stats = statsQuery.data

  React.useEffect(() => {
    const p = parseFocus(focusId)
    if (p.id) {
      setFolder(p.folder)
      // Reset the status filter too: a deep-linked item (e.g. an unread inbox message) must not be
      // hidden by a stale cross-folder box (e.g. "archived"/"out"), which would then let the
      // auto-select effect override the requested selection with the filtered list's first row.
      setBox("all")
      setSelId(p.id)
    }
  }, [focusId])
  React.useEffect(() => {
    if (!selId && activeIds.length) setSelId(activeIds[0]!)
    if (selId && activeIds.length && !activeIds.includes(selId)) setSelId(activeIds[0]!)
  }, [activeIds, selId])

  const switchFolder = (next: Folder) => {
    if (next === folder) return
    setFolder(next)
    setBox("all")
    setSelId(null)
    setQuery("")
    setDebouncedQuery("")
  }

  const select = (id: string) => {
    setSelId(id)
    if (outreach) {
      const row = mailItems.find((t) => t.id === id)
      if (row?.unread) markRead.mutate({ id })
    } else {
      const row = inboxItems.find((i) => i.id === id)
      if (row?.unread) setInboxStatus.mutate({ id, status: "read" })
    }
  }

  const onSend = (input: { to: string; subject: string; body: string }) => {
    compose.mutate(input, {
      onSuccess: () => {
        setComposeOpen(false)
        // Composing always starts an outreach thread; jump to that folder so the new thread (prepended
        // server-side) opens once the invalidated list re-fetches (the list effect picks items[0]).
        setFolder("outreach")
        setBox("all")
        setSelId(null)
        toast(`Message sent to ${input.to}`)
      },
      // Keep the modal open on failure (the user's draft is preserved) and surface why, so a failed
      // send is never a silent no-op.
      onError: (err) => {
        toast(errorMessage(err, {}, { fallback: "Couldn't send the message. Please try again." }))
      },
    })
  }

  const statusOptions = outreach
    ? [
        { value: "all", label: "All", count: mailCounts.all },
        { value: "in", label: "Inbound", count: mailCounts.in },
        { value: "out", label: "Outbound", count: mailCounts.out },
        { value: "attn", label: "Needs attention", count: mailCounts.attn },
      ]
    : [
        { value: "all", label: "All", count: inboxCounts.all },
        { value: "unread", label: "Unread", count: inboxCounts.unread },
        { value: "archived", label: "Archived", count: inboxCounts.archived },
      ]

  return (
    <>
      <PageHead
        title="Mail"
        subtitle={
          <span>
            Two-way outreach with municipal contacts, plus catch-all inbound to{" "}
            <span className="mono">*@civfix.org</span>.
          </span>
        }
      >
        <button className="btn primary" onClick={() => setComposeOpen(true)}>
          <Icons.Send size={13} /> Compose
        </button>
      </PageHead>

      {/* Folder switch — the primary control. Anchored ABOVE the deliverability strip so it never
          shifts under the cursor when toggling folders shows/hides the strip below it. A radiogroup
          (pick one of two modes), not tabs: there are no linked tabpanels to navigate. */}
      <div className="mailbox-switch" role="radiogroup" aria-label="Mailbox folder">
        <button
          className={`mbx ${outreach ? "active" : ""}`}
          role="radio"
          aria-checked={outreach}
          onClick={() => switchFolder("outreach")}
        >
          <Icons.Mail size={13} /> Outreach
          {mailCounts.all > 0 && <span className="mbx-c">{mailCounts.all}</span>}
        </button>
        <button
          className={`mbx ${!outreach ? "active" : ""}`}
          role="radio"
          aria-checked={!outreach}
          onClick={() => switchFolder("inbox")}
        >
          <Icons.Inbox size={13} /> Inbox
          {inboxCounts.all > 0 && <span className="mbx-c">{inboxCounts.all}</span>}
        </button>
      </div>

      {/* Deliverability strip (outreach only — these KPIs describe outbound mail health). */}
      {outreach &&
        (statsQuery.isLoading ? (
          <div className="strip-state">
            <LoadingState label="Loading deliverability..." />
          </div>
        ) : statsQuery.isError ? (
          <div className="strip-state">
            <ErrorState error={statsQuery.error} onRetry={() => statsQuery.refetch()} />
          </div>
        ) : stats ? (
          (() => {
            // The stats DTO carries placement/bounce/complaint as 0-1 fractions (delivered/sent etc.);
            // render them as percents. delivered7d is a raw count — show it plainly, compacting to "k"
            // only once it crosses ~10k (so 30 reads "30", not "0.0k").
            const placement = Math.round(stats.placement7d * 100)
            const aboveTarget = placement >= 80
            return (
              <div className="statusstrip mail-strip">
                <div className={`statcell ${aboveTarget ? "tone-ok" : "tone-alert"}`}>
                  <div className="statcell-label">Deliverability · 7d</div>
                  <div className="statcell-num">{placement}%</div>
                  <div className="statcell-hot">
                    {aboveTarget ? "Above 80% target" : "Below 80% target"}
                  </div>
                </div>
                <div className="statcell">
                  <div className="statcell-label">Delivered</div>
                  <div className="statcell-num">
                    {stats.delivered7d >= 10000
                      ? `${(stats.delivered7d / 1000).toFixed(1)}k`
                      : stats.delivered7d.toLocaleString()}
                  </div>
                  <div className="statcell-hot">last 7 days</div>
                </div>
                <div className="statcell tone-info">
                  <div className="statcell-label">Bounce rate</div>
                  <div className="statcell-num">{pct(stats.bounceRate, 1)}%</div>
                  <div className="statcell-hot">{pct(stats.complaintRate, 2)}% complaints</div>
                </div>
                <div className="statcell">
                  <div className="statcell-label">Unread</div>
                  <div className="statcell-num">{stats.unread}</div>
                  <div className="statcell-hot">awaiting reply</div>
                </div>
              </div>
            )
          })()
        ) : null)}

      {/* Sending-domain health (outreach only) — the getMailStats domainHealth[] rows the strip omits. */}
      {outreach && stats && stats.domainHealth.length > 0 && (
        <div className="mail-domains">
          {stats.domainHealth.map((d) => (
            <div key={d.domain} className="mail-domain">
              <span className={`pill ${DOMAIN_HEALTH_CLS[d.status]} tight`}>{d.status}</span>
              <span className="mail-domain-name mono">{d.domain}</span>
              <span className="mail-domain-note">{d.note}</span>
            </div>
          ))}
        </div>
      )}

      <div className="toolbar">
        <FilterChips options={statusOptions} value={box} onChange={setBox} />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            placeholder={outreach ? "Search org, subject, sender…" : "Search sender, subject…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>{BOX_LABEL[box] ?? "All"}</h3>
            <div className="spacer" />
            <span className="meta">{activeCount}</span>
          </div>
          <div className="queue-list">
            {activeListQuery.isLoading ? (
              <LoadingState label={outreach ? "Loading mail..." : "Loading inbox..."} />
            ) : activeListQuery.isError ? (
              <ErrorState error={activeListQuery.error} onRetry={() => activeListQuery.refetch()} />
            ) : activeCount === 0 ? (
              q ? (
                <EmptyState
                  title="Nothing matches"
                  sub="Try a different search."
                  icon={<Icons.Search size={20} />}
                />
              ) : (
                <EmptyState
                  title="Empty"
                  sub="No messages here."
                  icon={outreach ? <Icons.Mail size={20} /> : <Icons.Inbox size={20} />}
                />
              )
            ) : outreach ? (
              mailItems.map((t) => (
                <MailRow
                  key={t.id}
                  item={t}
                  selected={selId === t.id}
                  onClick={() => select(t.id)}
                />
              ))
            ) : (
              inboxItems.map((i) => (
                <InboxRow
                  key={i.id}
                  item={i}
                  selected={selId === i.id}
                  onClick={() => select(i.id)}
                />
              ))
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            outreach ? (
              <MailReader key={selId} threadId={selId} />
            ) : (
              <InboxReader key={selId} id={selId} />
            )
          ) : (
            <EmptyState
              title="No message selected"
              icon={outreach ? <Icons.Mail size={20} /> : <Icons.Inbox size={20} />}
            />
          )}
        </section>
      </div>

      <ComposeModal
        open={composeOpen}
        pending={compose.isPending}
        onClose={() => setComposeOpen(false)}
        onSend={onSend}
      />
    </>
  )
}

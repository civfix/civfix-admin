"use client"

import * as React from "react"
import {
  MAIL_STATUS_LABELS,
  type MailStatus,
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
import { useNav, useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Mail / outreach (ported from pages-mail.jsx, enumeration 2.E). Layout: PageHead + Compose, a
 * deliverability strip (4 cells wired to getMailStats), filter chips (All / Inbound / Outbound /
 * Needs attention), a master-detail of the thread list (listMail) + the reader (getMailThread), and a
 * Compose modal. All wired to the typed admin client (no window.DATA).
 *
 * Reconciliation: the design's `needs-action` becomes the civfix `needs_action`; the status pill
 * renders via MAIL_STATUS_LABELS. Selecting a thread fires markMailRead; Reply -> replyMail; Mark done
 * -> setMailStatus(replied); a bounced thread offers Resend / Fix routing (-> resendMail) and, when the
 * thread links a jurisdiction, a deep-link into Jurisdictions to fix the routing contact.
 */

/** The needs-attention statuses (the design's {needs-action, bounced}). */
const ATTENTION: MailStatus[] = ["needs_action", "bounced"]

/** Pill treatment per mail status (matches the design's MAIL_STATUS class mapping). */
const STATUS_CLS: Record<MailStatus, string> = {
  replied: "status-ok",
  delivered: "status-ok",
  auto: "status-progress",
  opened: "status-progress",
  sent: "status-progress",
  needs_action: "status-flag",
  bounced: "status-flag",
}

/** The thread-list card title per selected box. */
const BOX_LABEL: Record<string, string> = {
  all: "All mail",
  in: "Inbound",
  out: "Outbound",
  attn: "Needs attention",
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
              placeholder="Write your message..."
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
          <span className="mail-from">{item.org}</span>
          <span className="mail-ts mono">{item.ts}</span>
        </div>
        <div className="mail-subject">{item.subject}</div>
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

  const sendReply = () => {
    const body = text.trim()
    if (!body) return
    reply.mutate(
      { id: sel.id, body },
      {
        onSuccess: () => {
          setText("")
          toast(`Reply sent to ${sel.org}`)
          setTimeout(() => {
            if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
          }, 50)
        },
      },
    )
  }

  const markDone = () => {
    setStatus.mutate(
      { id: sel.id, status: "replied" },
      { onSuccess: () => toast("Marked done") },
    )
  }

  const onResend = () => {
    resend.mutate({ id: sel.id }, { onSuccess: () => toast("Message resent") })
  }

  const onFixRouting = () => {
    if (sel.jurisdictionGeoid) {
      nav("discovery", sel.jurisdictionGeoid)
      return
    }
    resend.mutate({ id: sel.id }, { onSuccess: () => toast("Routing contact flagged for fix") })
  }

  return (
    <div className="mail-reader">
      <div className="mail-reader-head">
        <div className="mail-reader-subj">{sel.subject}</div>
        <div className="mail-reader-meta">
          <span className={`mail-dir ${sel.dir}`}>
            {sel.dir === "in" ? <Icons.ArrowDown size={12} /> : <Icons.ArrowUp size={12} />}
          </span>
          <span className="mono">{sel.from}</span>
          <span className="sep">-</span>
          <span>{sel.org}</span>
          <span className="spacer" />
          <span className={`pill ${STATUS_CLS[sel.status]} tight`}>
            {MAIL_STATUS_LABELS[sel.status]}
          </span>
        </div>
      </div>

      <div className="mail-reader-body" ref={bodyRef}>
        <div className="mail-thread">
          {sel.messages.map((msg) => (
            <div key={msg.id} className={`mail-msg ${msg.dir === "out" ? "out" : "in"}`}>
              <div className="mail-msg-head">
                <span className="mail-msg-who">{msg.who}</span>
                <span className="mail-msg-addr mono">{msg.from}</span>
                <span className="spacer" />
                <span className="mail-msg-ts mono">{msg.ts}</span>
              </div>
              <p className="mail-msg-body">{msg.body}</p>
            </div>
          ))}
        </div>

        {sel.status === "bounced" && (
          <div className="mail-bounce-note">
            <Icons.AlertTriangle size={14} />
            Hard bounce - the address rejected delivery. Try a different contact or the city&apos;s
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
          <button className="btn primary" disabled={resend.isPending} onClick={onFixRouting}>
            <Icons.AlertTriangle size={13} /> Fix routing contact
          </button>
          <button className="btn" disabled={resend.isPending} onClick={onResend}>
            <Icons.Send size={13} /> Resend
          </button>
        </div>
      ) : (
        <div className="mail-composer">
          <textarea
            className="mail-reply-input"
            rows={3}
            placeholder={`Reply to ${sel.org}...`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendReply()
            }}
          />
          <div className="mail-composer-foot">
            <span className="mail-reply-to">
              To <span className="mono">{sel.from}</span>
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
              <Icons.Send size={13} /> Reply <span className="kbdhint">Cmd+Enter</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function MailPage({ focusId }: SectionPageProps) {
  const [box, setBox] = React.useState("all")
  const [selId, setSelId] = React.useState<string | null>(focusId)
  const [composeOpen, setComposeOpen] = React.useState(false)

  const toast = useToast()
  const compose = useComposeMail()
  const markRead = useMarkMailRead()

  const listParams = {
    dir: box === "in" ? ("in" as const) : box === "out" ? ("out" as const) : undefined,
    filter: box === "attn" ? ("attn" as const) : undefined,
  }
  const listQuery = useMailList(listParams)
  const items = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data])

  // Unfiltered fetch for stable chip counts + the deliverability "threads total" fallback.
  const allQuery = useMailList({})
  const allItems = React.useMemo(() => allQuery.data?.items ?? [], [allQuery.data])
  const counts = {
    all: allItems.length,
    in: allItems.filter((t) => t.dir === "in").length,
    out: allItems.filter((t) => t.dir === "out").length,
    attn: allItems.filter((t) => ATTENTION.includes(t.status)).length,
  }

  const statsQuery = useMailStats()
  const stats = statsQuery.data

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.id)
    if (selId && items.length && !items.some((x) => x.id === selId)) setSelId(items[0]!.id)
  }, [items, selId])

  const selectThread = (id: string) => {
    setSelId(id)
    const row = items.find((t) => t.id === id)
    if (row?.unread) markRead.mutate({ id })
  }

  const onSend = (input: { to: string; subject: string; body: string }) => {
    compose.mutate(input, {
      onSuccess: () => {
        setComposeOpen(false)
        setBox("all")
        toast(`Message sent to ${input.to}`)
      },
    })
  }

  return (
    <>
      <PageHead
        title="Mail"
        subtitle={
          <span>
            Two-way mail with municipal contacts - outbound routing and the replies that come back.
            Powered by OCI Email Delivery + Cloudflare Routing.
          </span>
        }
      >
        <button className="btn primary" onClick={() => setComposeOpen(true)}>
          <Icons.Send size={13} /> Compose
        </button>
      </PageHead>

      {/* Deliverability strip (4 cells) */}
      <div className="statusstrip mail-strip">
        {statsQuery.isLoading ? (
          <LoadingState label="Loading deliverability..." />
        ) : statsQuery.isError ? (
          <ErrorState error={statsQuery.error} onRetry={() => statsQuery.refetch()} />
        ) : stats ? (
          <>
            <div className="statcell tone-ok">
              <div className="statcell-label">Deliverability - 7d</div>
              <div className="statcell-num">{stats.placement7d}%</div>
              <div className="statcell-hot">Above 80% target</div>
            </div>
            <div className="statcell">
              <div className="statcell-label">Delivered</div>
              <div className="statcell-num">{(stats.delivered7d / 1000).toFixed(1)}k</div>
              <div className="statcell-hot">last 7 days</div>
            </div>
            <div className="statcell tone-info">
              <div className="statcell-label">Bounce rate</div>
              <div className="statcell-num">{stats.bounceRate}%</div>
              <div className="statcell-hot">{stats.complaintRate}% complaints</div>
            </div>
            <div className="statcell">
              <div className="statcell-label">Unread</div>
              <div className="statcell-num">{stats.unread}</div>
              <div className="statcell-hot">{stats.threads} threads total</div>
            </div>
          </>
        ) : null}
      </div>

      <div className="toolbar">
        <FilterChips
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "in", label: "Inbound", count: counts.in },
            { value: "out", label: "Outbound", count: counts.out },
            { value: "attn", label: "Needs attention", count: counts.attn },
          ]}
          value={box}
          onChange={setBox}
        />
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>{BOX_LABEL[box] ?? "All mail"}</h3>
            <div className="spacer" />
            <span className="meta">{items.length}</span>
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading mail..." />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState title="Empty" sub="No messages here." icon={<Icons.Mail size={20} />} />
            ) : (
              items.map((t) => (
                <MailRow
                  key={t.id}
                  item={t}
                  selected={selId === t.id}
                  onClick={() => selectThread(t.id)}
                />
              ))
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            <MailReader key={selId} threadId={selId} />
          ) : (
            <EmptyState title="No message selected" icon={<Icons.Mail size={20} />} />
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

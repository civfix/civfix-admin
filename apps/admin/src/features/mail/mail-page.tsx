"use client"

import * as React from "react"
import {
  DEFAULT_FORWARD_BODY_TEMPLATE,
  DEFAULT_FORWARD_SUBJECT_TEMPLATE,
  MAIL_STATUS_LABELS,
  relativeAgo,
  type MailMessageDTO,
  type MailThreadDTO,
  type MailThreadListItemDTO,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import {
  PageHead,
  FilterChips,
  EmptyState,
  type FilterOption,
} from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import {
  useComposeMail,
  useForwardTemplateDefault,
  useMailListInfinite,
  useMailStats,
  useMailThread,
  useMarkMailRead,
  useReplyMail,
  useResendMail,
  useSetForwardTemplateDefault,
  useSetMailStatus,
} from "@/features/mail/use-mail"
import { ForwardTemplateModal } from "@/features/mail/forward-template-modal"
import { useInboxListInfinite, useSetInboxStatus } from "@/features/inbox/use-inbox"
import { InboxRow, InboxReader } from "@/features/inbox/inbox-views"
import { AuthVerdictBadge, PublicationBadge } from "@/features/mail/mail-badges"
import { MAIL_STATUS_CLS } from "@/features/mail/mail-presentation"
import { useNav, useToast } from "@/store/ui-store"
import { toAppError } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import type { SectionPageProps } from "@/components/shell/page-registry"


type Folder = "outreach" | "inbox"

const BOX_LABEL: Record<string, string> = {
  all: "All",
  in: "Inbound",
  out: "Outbound",
  attn: "Needs attention",
  unread: "Unread",
  archived: "Archived",
}

const DELIVERY_BADGE = {
  failed: {
    cls: "status-flag",
    label: "Not delivered",
    title: "The mail provider rejected this message; use Resend",
  },
  pending: {
    cls: "status-new",
    label: "Sending…",
    title: "Handed to the mail provider; no delivery confirmation yet",
  },
} as const

function DeliveryBadge({ delivery }: { delivery: MailMessageDTO["delivery"] }) {
  if (delivery !== "failed" && delivery !== "pending") return null
  const badge = DELIVERY_BADGE[delivery]
  return (
    <span className={`pill ${badge.cls} tight mail-msg-delivery`} title={badge.title}>
      {badge.label}
    </span>
  )
}

function parseFocus(focusId: string | null): { folder: Folder; id: string | null } {
  if (!focusId) return { folder: "outreach", id: null }
  if (focusId.startsWith("inbox:")) return { folder: "inbox", id: focusId.slice("inbox:".length) }
  return { folder: "outreach", id: focusId }
}

function ts(value: string): string {
  return relativeAgo(value)
}

function tsTitle(value: string): string {
  if (!value) return ""
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString()
}

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
            From civfix, via a per-conversation <span className="mono">reply-…</span> address
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
      <span className={`pill ${MAIL_STATUS_CLS[item.status]} tight mail-status-pill`}>
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

  const markReplied = () => {
    setStatus.mutate(
      { id: sel.id, status: "replied" },
      {
        onSuccess: () => toast("Marked replied"),
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
          <span className={`pill ${MAIL_STATUS_CLS[sel.status]} tight`}>
            {MAIL_STATUS_LABELS[sel.status]}
          </span>
        </div>
        {(sel.jurisdictionGeoid || sel.reportId) && (
          <div className="mail-reader-links">
            {sel.jurisdictionGeoid && (
              <button
                type="button"
                className="lnk-inline"
                title="Open this thread's jurisdiction"
                onClick={() => nav("discovery", sel.jurisdictionGeoid!)}
              >
                <Icons.Building size={12} /> View jurisdiction
              </button>
            )}
            {sel.reportId && (
              <button
                type="button"
                className="lnk-inline"
                title="Open the report this thread is about"
                onClick={() => nav("reports", sel.reportId!)}
              >
                <Icons.FileText size={12} /> View report
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mail-reader-body" ref={bodyRef}>
        <div className="mail-thread">
          {sel.messages.map((msg) => {
            const isOut = msg.dir === "out"
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
                  {isOut ? (
                    <DeliveryBadge delivery={msg.delivery} />
                  ) : (
                    <>
                      <AuthVerdictBadge verdict={msg.authVerdict} />
                      <PublicationBadge
                        publication={msg.publication}
                        isReport={sel.reportId !== null}
                      />
                    </>
                  )}
                </div>
                <p className="mail-msg-body">{msg.body}</p>
                {msg.truncated && (
                  <div className="hint">This message was cut at 64 KB for display.</div>
                )}
                {msg.attachments.length > 0 && (
                  <div className="mail-attachments">
                    {msg.attachments.map((att) => (
                      <a
                        key={att.key}
                        className="btn sm"
                        href={att.key}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icons.ExternalLink size={13} /> {att.filename}
                        <span className="mono" style={{ marginLeft: 6, opacity: 0.6 }}>
                          {(att.size / 1024).toFixed(0)}k
                        </span>
                      </a>
                    ))}
                  </div>
                )}
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
            <button
              className="btn"
              disabled={setStatus.isPending}
              onClick={markReplied}
              title="Marks this thread replied without sending a message"
            >
              <Icons.Check size={13} /> Mark replied
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
  const [templateOpen, setTemplateOpen] = React.useState(false)
  const outreach = folder === "outreach"

  const [query, setQuery] = React.useState("")
  const [debouncedQuery, setDebouncedQuery] = React.useState("")
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])
  const q = debouncedQuery || undefined

  const toast = useToast()
  const compose = useComposeMail()
  const forwardTemplate = useForwardTemplateDefault()
  const setForwardTemplate = useSetForwardTemplateDefault()
  const markRead = useMarkMailRead()
  const setInboxStatus = useSetInboxStatus()

  const mailListQuery = useMailListInfinite(
    outreach
      ? {
          dir: box === "in" ? ("in" as const) : box === "out" ? ("out" as const) : undefined,
          filter: box === "attn" ? ("attn" as const) : undefined,
          q,
        }
      : {},
  )
  const inboxListQuery = useInboxListInfinite(
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

  const mailItems = React.useMemo(
    () => mailListQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [mailListQuery.data],
  )
  const inboxItems = React.useMemo(
    () => inboxListQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [inboxListQuery.data],
  )
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
        setFolder("outreach")
        setBox("all")
        setSelId(null)
        toast(`Message sent to ${input.to}`)
      },
      onError: (err) => {
        toast(errorMessage(err, {}, { fallback: "Couldn't send the message. Please try again." }))
      },
    })
  }

  const statusOptions: FilterOption[] = outreach
    ? [
        { value: "all", label: "All", ...(stats ? { count: stats.threads } : {}) },
        { value: "in", label: "Inbound" },
        { value: "out", label: "Outbound" },
        { value: "attn", label: "Needs attention" },
      ]
    : [
        { value: "all", label: "All" },
        { value: "unread", label: "Unread" },
        { value: "archived", label: "Archived" },
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
        <button
          className="btn"
          disabled={forwardTemplate.isLoading}
          onClick={() => {
            if (forwardTemplate.isError) {
              toast(toAppError(forwardTemplate.error).message)
              return
            }
            setTemplateOpen(true)
          }}
        >
          <Icons.FileText size={13} /> Default template
        </button>
        <button className="btn primary" onClick={() => setComposeOpen(true)}>
          <Icons.Send size={13} /> Compose
        </button>
      </PageHead>

      { }
      <div className="mailbox-switch" role="radiogroup" aria-label="Mailbox folder">
        <button
          className={`mbx ${outreach ? "active" : ""}`}
          role="radio"
          aria-checked={outreach}
          onClick={() => switchFolder("outreach")}
        >
          <Icons.Mail size={13} /> Outreach
          {stats && stats.threads > 0 && <span className="mbx-c">{stats.threads}</span>}
        </button>
        <button
          className={`mbx ${!outreach ? "active" : ""}`}
          role="radio"
          aria-checked={!outreach}
          onClick={() => switchFolder("inbox")}
        >
          <Icons.Inbox size={13} /> Inbox
        </button>
      </div>

      {outreach &&
        (statsQuery.isLoading ? (
          <div className="strip-state">
            <LoadingState label="Loading mail stats..." />
          </div>
        ) : statsQuery.isError ? (
          <div className="strip-state">
            <ErrorState error={statsQuery.error} onRetry={() => statsQuery.refetch()} />
          </div>
        ) : stats ? (
          stats.sent === 0 && stats.bounced === 0 && stats.failed === 0 ? (
            <div className="statusstrip mail-strip">
              <div className="statcell">
                <div className="statcell-label">Outbound · 7d</div>
                <div className="statcell-num">—</div>
                <div className="statcell-hot">No outbound mail in the last 7 days</div>
              </div>
              <div className="statcell">
                <div className="statcell-label">Unread</div>
                <div className="statcell-num">{stats.unread}</div>
                <div className="statcell-hot">awaiting reply</div>
              </div>
            </div>
          ) : (
            <div className="statusstrip mail-strip">
              <div className="statcell tone-ok">
                <div className="statcell-label">Sent · 7d</div>
                <div className="statcell-num">{stats.sent.toLocaleString()}</div>
                <div className="statcell-hot">outbound to cities</div>
              </div>
              <div className={`statcell ${stats.bounced > 0 ? "tone-alert" : ""}`}>
                <div className="statcell-label">Bounced</div>
                <div className="statcell-num">{stats.bounced.toLocaleString()}</div>
                <div className="statcell-hot">last 7 days</div>
              </div>
              <div className={`statcell ${stats.failed > 0 ? "tone-alert" : ""}`}>
                <div className="statcell-label">Failed</div>
                <div className="statcell-num">{stats.failed.toLocaleString()}</div>
                <div className="statcell-hot">send rejected</div>
              </div>
              <div className="statcell">
                <div className="statcell-label">Unread</div>
                <div className="statcell-num">{stats.unread}</div>
                <div className="statcell-hot">awaiting reply</div>
              </div>
            </div>
          )
        ) : null)}

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
            ) : (
              <>
                {outreach
                  ? mailItems.map((t) => (
                      <MailRow
                        key={t.id}
                        item={t}
                        selected={selId === t.id}
                        onClick={() => select(t.id)}
                      />
                    ))
                  : inboxItems.map((i) => (
                      <InboxRow
                        key={i.id}
                        item={i}
                        selected={selId === i.id}
                        onClick={() => select(i.id)}
                      />
                    ))}
                {activeListQuery.hasNextPage && (
                  <button
                    type="button"
                    className="btn"
                    style={{ width: "calc(100% - 20px)", margin: "8px 10px" }}
                    disabled={activeListQuery.isFetchingNextPage}
                    onClick={() => activeListQuery.fetchNextPage()}
                  >
                    {activeListQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                  </button>
                )}
              </>
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

      <ForwardTemplateModal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Default forwarding email"
        subtitle="Sent for every jurisdiction that has no template of its own. Clear both fields to fall back to the built-in template."
        initial={{
          subject: forwardTemplate.data?.subjectTemplate ?? null,
          body: forwardTemplate.data?.bodyTemplate ?? null,
        }}
        fallback={{
          subject: DEFAULT_FORWARD_SUBJECT_TEMPLATE,
          body: DEFAULT_FORWARD_BODY_TEMPLATE,
        }}
        fallbackLabel="built-in template"
        pending={setForwardTemplate.isPending}
        onSave={({ subject, body }) =>
          setForwardTemplate.mutate(
            { subjectTemplate: subject, bodyTemplate: body },
            {
              onSuccess: () => {
                toast("Default template saved")
                setTemplateOpen(false)
              },
              onError: (err) => toast(toAppError(err).message),
            },
          )
        }
      />
    </>
  )
}

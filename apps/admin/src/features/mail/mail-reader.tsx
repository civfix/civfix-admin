"use client"

import * as React from "react"
import {
  MAIL_STATUS_LABELS,
  relativeAgo,
  type MailMessageDTO,
  type MailThreadDTO,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { AttachmentList } from "@/features/inbox/attachment-chip"
import { AuthVerdictBadge, PublicationBadge } from "@/features/mail/mail-badges"
import { correspondent } from "@/features/mail/mail-page-state"
import { MAIL_STATUS_CLS, tsTitle } from "@/features/mail/mail-presentation"
import { useMailThread, useReplyMail, useResendMail, useSetMailStatus } from "@/features/mail/use-mail"
import { WithheldReplyNote } from "@/features/mail/withheld-reply-note"
import { useNav } from "@/store/ui-store"

// The API cuts an inbound body at this size before it reaches the reader; the copy names the cap.
const DISPLAY_TRUNCATION_KB = 64

const REPLY_SCROLL_DELAY_MS = 50

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

function ReaderLinks({ thread, eventId }: { thread: MailThreadDTO; eventId: string | null }) {
  const nav = useNav()
  if (!thread.jurisdictionGeoid && !thread.reportId && !eventId) return null
  return (
    <div className="mail-reader-links">
      {thread.jurisdictionGeoid && (
        <button
          type="button"
          className="lnk-inline"
          title="Open this thread's jurisdiction"
          onClick={() => nav("discovery", thread.jurisdictionGeoid!)}
        >
          <Icons.Building size={12} /> View jurisdiction
        </button>
      )}
      {thread.reportId && (
        <button
          type="button"
          className="lnk-inline"
          title="Open the report this thread is about"
          onClick={() => nav("reports", thread.reportId!)}
        >
          <Icons.FileText size={12} /> View report
        </button>
      )}
      {eventId && (
        <button
          type="button"
          className="lnk-inline"
          title="Open the event this thread is about"
          onClick={() => nav("events", eventId)}
        >
          <Icons.Calendar size={12} /> View event
        </button>
      )}
    </div>
  )
}

function ReaderHead({
  thread,
  who,
  eventId,
}: {
  thread: MailThreadDTO
  who: string
  eventId: string | null
}) {
  return (
    <div className="mail-reader-head">
      <div className="mail-reader-subj">{thread.subject || "(no subject)"}</div>
      <div className="mail-reader-meta">
        <span className={`mail-dir ${thread.dir}`}>
          {thread.dir === "in" ? <Icons.ArrowDown size={12} /> : <Icons.ArrowUp size={12} />}
        </span>
        <span className="mono">{who}</span>
        {thread.org && (
          <>
            <span className="sep">·</span>
            <span>{thread.org}</span>
          </>
        )}
        <span className="spacer" />
        <span className={`pill ${MAIL_STATUS_CLS[thread.status]} tight`}>
          {MAIL_STATUS_LABELS[thread.status]}
        </span>
      </div>
      <ReaderLinks thread={thread} eventId={eventId} />
    </div>
  )
}

function ThreadMessage({ thread, message }: { thread: MailThreadDTO; message: MailMessageDTO }) {
  const isOut = message.dir === "out"
  const isReport = thread.reportId !== null
  const address = isOut ? (message.to ? `to ${message.to}` : "") : message.from
  return (
    <div className={`mail-msg ${isOut ? "out" : "in"}`}>
      <div className="mail-msg-head">
        <span className="mail-msg-who">{message.who}</span>
        {address && <span className="mail-msg-addr mono">{address}</span>}
        <span className="spacer" />
        <span className="mail-msg-ts mono" title={tsTitle(message.ts)}>
          {relativeAgo(message.ts)}
        </span>
        {isOut ? (
          <DeliveryBadge delivery={message.delivery} />
        ) : (
          <>
            <AuthVerdictBadge verdict={message.authVerdict} />
            <PublicationBadge publication={message.publication} isReport={isReport} />
          </>
        )}
      </div>
      <p className="mail-msg-body">{message.body}</p>
      {message.publication === "withheld" && (
        <WithheldReplyNote threadId={thread.id} msg={message} isReport={isReport} />
      )}
      {message.truncated && (
        <div className="hint">{`This message was cut at ${DISPLAY_TRUNCATION_KB} KB for display.`}</div>
      )}
      <AttachmentList attachments={message.attachments} />
    </div>
  )
}

function ThreadNotes({ thread }: { thread: MailThreadDTO }) {
  const hasWithheld = thread.messages.some((m) => m.publication === "withheld")
  return (
    <>
      {thread.status === "bounced" && (
        <div className="mail-bounce-note">
          <Icons.AlertTriangle size={14} />
          Hard bounce: the address rejected delivery. Try a different contact or the city&apos;s
          reporting form.
        </div>
      )}
      {thread.dir === "in" && thread.status === "needs_action" && !hasWithheld && (
        <div className="mail-action-note">
          <Icons.CornerArr size={14} />
          Suggested: re-route this jurisdiction&apos;s contact in Jurisdictions.
        </div>
      )}
    </>
  )
}

function BounceFooter({
  thread,
  resending,
  onResend,
}: {
  thread: MailThreadDTO
  resending: boolean
  onResend: () => void
}) {
  const nav = useNav()
  const geoid = thread.jurisdictionGeoid
  return (
    <div className="mail-reader-foot">
      {geoid && (
        <button className="btn primary" onClick={() => nav("discovery", geoid)}>
          <Icons.AlertTriangle size={13} /> Fix routing contact
        </button>
      )}
      <button className="btn" disabled={resending} onClick={onResend}>
        <Icons.Send size={13} /> Resend
      </button>
    </div>
  )
}

function ReplyComposer({
  who,
  whoLabel,
  text,
  onTextChange,
  onSend,
  sending,
  onMarkReplied,
  markingReplied,
}: {
  who: string
  whoLabel: string
  text: string
  onTextChange: (text: string) => void
  onSend: () => void
  sending: boolean
  onMarkReplied: () => void
  markingReplied: boolean
}) {
  const hasText = !!text.trim()
  return (
    <div className="mail-composer">
      <textarea
        className="mail-reply-input"
        rows={3}
        aria-label="Reply"
        placeholder={`Reply to ${whoLabel}…`}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return
          e.preventDefault()
          onSend()
        }}
      />
      <div className="mail-composer-foot">
        <span className="mail-reply-to">
          To <span className="mono">{who}</span>
        </span>
        <div className="spacer" />
        <button
          className="btn"
          disabled={markingReplied}
          onClick={onMarkReplied}
          title="Marks this thread replied without sending a message"
        >
          <Icons.Check size={13} /> Mark replied
        </button>
        <button
          className={`btn ${hasText ? "primary" : ""}`}
          disabled={!hasText || sending}
          style={!hasText ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
          onClick={onSend}
        >
          <Icons.Send size={13} /> Reply <span className="kbdhint">⌘⏎</span>
        </button>
      </div>
    </div>
  )
}

export function MailReader({ threadId, eventId = null }: { threadId: string; eventId?: string | null }) {
  const threadQuery = useMailThread(threadId)
  const reply = useReplyMail()
  const setStatus = useSetMailStatus()
  const resend = useResendMail()
  // Held here rather than in the composer, which the bounce footer replaces while a thread is bounced,
  // so the draft and the pending states outlive that swap.
  const [text, setText] = React.useState("")
  const bodyRef = React.useRef<HTMLDivElement>(null)

  if (threadQuery.isLoading) return <LoadingState label="Loading thread..." />
  if (threadQuery.isError) {
    return <ErrorState error={threadQuery.error} onRetry={() => threadQuery.refetch()} />
  }
  const thread = threadQuery.data
  if (!thread) return <EmptyState title="No message selected" icon={<Icons.Mail size={20} />} />

  const who = correspondent(thread)
  const whoLabel = thread.org || who

  const sendReply = () => {
    const body = text.trim()
    if (!body || reply.isPending) return
    reply.mutate(
      { request: { id: thread.id, body }, recipient: whoLabel },
      {
        onSuccess: () => {
          setText("")
          setTimeout(() => {
            if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
          }, REPLY_SCROLL_DELAY_MS)
        },
      },
    )
  }

  return (
    <div className="mail-reader">
      <ReaderHead thread={thread} who={who} eventId={eventId} />

      <div className="mail-reader-body" ref={bodyRef}>
        <div className="mail-thread">
          {thread.messages.map((message) => (
            <ThreadMessage key={message.id} thread={thread} message={message} />
          ))}
        </div>
        <ThreadNotes thread={thread} />
      </div>

      {thread.status === "bounced" ? (
        <BounceFooter
          thread={thread}
          resending={resend.isPending}
          onResend={() => resend.mutate({ id: thread.id })}
        />
      ) : (
        <ReplyComposer
          who={who}
          whoLabel={whoLabel}
          text={text}
          onTextChange={setText}
          onSend={sendReply}
          sending={reply.isPending}
          onMarkReplied={() => setStatus.mutate({ id: thread.id, status: "replied" })}
          markingReplied={setStatus.isPending}
        />
      )}
    </div>
  )
}

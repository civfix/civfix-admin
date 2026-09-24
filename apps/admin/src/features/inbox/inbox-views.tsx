"use client"

import * as React from "react"
import {
  INBOUND_EMAIL_STATUS_LABELS,
  MAIL_STATUS_LABELS,
  relativeAgo,
  type InboundEmailStatus,
  type InboxFeedItemDTO,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { formatPreciseDateTime } from "@/lib/dates"
import { AttachmentList } from "@/features/inbox/attachment-chip"
import { useInboxMessage, useSetInboxStatus } from "@/features/inbox/use-inbox"
import { replyOriginLabel } from "@/features/inbox/inbox-feed"
import { AuthVerdictBadge, PublicationBadge } from "@/features/mail/mail-badges"
import { MAIL_STATUS_CLS } from "@/features/mail/mail-presentation"

const INBOUND_STATUS_CLS: Record<InboundEmailStatus, string> = {
  unread: "status-flag",
  read: "status-ok",
  archived: "status-progress",
}

export function InboxRow({
  item,
  selected,
  onClick,
}: {
  item: InboxFeedItemDTO
  selected: boolean
  onClick: () => void
}) {
  const isEmail = item.source === "email"
  return (
    <div
      className={`mail-row ${selected ? "selected" : ""} ${item.unread ? "unread" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        onClick()
      }}
    >
      <span className="mail-dir in">
        <Icons.ArrowDown size={13} />
      </span>
      <div className="mail-row-body">
        <div className="mail-row-top">
          <span className="mail-from">
            {(isEmail ? item.from : item.org || item.from) || "(unknown sender)"}
          </span>
          <span className="mail-ts mono" title={formatPreciseDateTime(item.ts)}>
            {relativeAgo(item.ts)}
          </span>
        </div>
        <div className="mail-subject">
          {item.subject || "(no subject)"}
          {item.hasAttachments && (
            <span
              className="mono"
              role="img"
              aria-label="Has attachments"
              title="Has attachments"
              style={{ marginLeft: 6, color: "var(--ink-3)" }}
            >
              <Icons.ExternalLink size={11} />
            </span>
          )}
        </div>
        <div className="mail-preview">
          <span className="mono">
            {isEmail ? item.localPart || item.recipient : replyOriginLabel(item)}
          </span>{" "}
          {item.preview}
        </div>
      </div>
      {isEmail ? (
        <span className={`pill ${INBOUND_STATUS_CLS[item.status]} tight mail-status-pill`}>
          {INBOUND_EMAIL_STATUS_LABELS[item.status]}
        </span>
      ) : item.publication ? (
        <PublicationBadge
          publication={item.publication}
          isReport={item.reportId !== null}
          className="mail-status-pill"
        />
      ) : (
        <span className={`pill ${MAIL_STATUS_CLS[item.threadStatus]} tight mail-status-pill`}>
          {MAIL_STATUS_LABELS[item.threadStatus]}
        </span>
      )}
    </div>
  )
}

export function InboxReader({ id }: { id: string }) {
  const messageQuery = useInboxMessage(id)
  const setStatus = useSetInboxStatus()

  if (messageQuery.isLoading) return <LoadingState label="Loading message..." />
  if (messageQuery.isError) {
    return <ErrorState error={messageQuery.error} onRetry={() => messageQuery.refetch()} />
  }
  const message = messageQuery.data
  if (!message) return <EmptyState title="No message selected" icon={<Icons.Inbox size={20} />} />

  const markRead = () => setStatus.mutate({ id: message.id, status: "read" })
  const archive = () => setStatus.mutate({ id: message.id, status: "archived" })

  return (
    <div className="mail-reader">
      <div className="mail-reader-head">
        <div className="mail-reader-subj">{message.subject || "(no subject)"}</div>
        <div className="mail-reader-meta">
          <span className="mail-dir in">
            <Icons.ArrowDown size={12} />
          </span>
          <span className="mono">{message.from}</span>
          <span className="sep">·</span>
          <span>to {message.recipient}</span>
          <AuthVerdictBadge verdict={message.authVerdict} />
          <span className="spacer" />
          <span className={`pill ${INBOUND_STATUS_CLS[message.status]} tight`}>
            {INBOUND_EMAIL_STATUS_LABELS[message.status]}
          </span>
        </div>
      </div>

      <div className="mail-reader-body">
        <div className="mail-thread">
          <div className="mail-msg in">
            <p className="mail-msg-body" style={{ whiteSpace: "pre-wrap" }}>
              {message.bodyText || "(no plain-text body)"}
            </p>
          </div>
        </div>

        <AttachmentList attachments={message.attachments} />
      </div>

      <div className="mail-reader-foot">
        <button
          className="btn"
          disabled={setStatus.isPending || message.status === "read"}
          onClick={markRead}
        >
          <Icons.Eye size={13} /> Mark read
        </button>
        <button
          className="btn"
          disabled={setStatus.isPending || message.status === "archived"}
          onClick={archive}
        >
          <Icons.Inbox size={13} /> Archive
        </button>
      </div>
    </div>
  )
}

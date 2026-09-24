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
import { AttachmentList } from "@/features/inbox/attachment-chip"
import { useInboxMessage, useSetInboxStatus } from "@/features/inbox/use-inbox"
import { replyOriginLabel } from "@/features/inbox/inbox-feed"
import { AuthVerdictBadge, PublicationBadge } from "@/features/mail/mail-badges"
import { MAIL_STATUS_CLS, tsTitle } from "@/features/mail/mail-presentation"
import { useToast } from "@/store/ui-store"

const STATUS_CLS: Record<InboundEmailStatus, string> = {
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
          <span className="mail-ts mono" title={tsTitle(item.ts)}>
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
        <span className={`pill ${STATUS_CLS[item.status]} tight mail-status-pill`}>
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
  const q = useInboxMessage(id)
  const toast = useToast()
  const setStatus = useSetInboxStatus()

  if (q.isLoading) return <LoadingState label="Loading message..." />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const sel = q.data
  if (!sel) return <EmptyState title="No message selected" icon={<Icons.Inbox size={20} />} />

  const markRead = () =>
    setStatus.mutate({ id: sel.id, status: "read" }, { onSuccess: () => toast("Marked read") })
  const archive = () =>
    setStatus.mutate({ id: sel.id, status: "archived" }, { onSuccess: () => toast("Archived") })

  return (
    <div className="mail-reader">
      <div className="mail-reader-head">
        <div className="mail-reader-subj">{sel.subject || "(no subject)"}</div>
        <div className="mail-reader-meta">
          <span className="mail-dir in">
            <Icons.ArrowDown size={12} />
          </span>
          <span className="mono">{sel.from}</span>
          <span className="sep">·</span>
          <span>to {sel.recipient}</span>
          <AuthVerdictBadge verdict={sel.authVerdict} />
          <span className="spacer" />
          <span className={`pill ${STATUS_CLS[sel.status]} tight`}>
            {INBOUND_EMAIL_STATUS_LABELS[sel.status]}
          </span>
        </div>
      </div>

      <div className="mail-reader-body">
        <div className="mail-thread">
          <div className="mail-msg in">
            <p className="mail-msg-body" style={{ whiteSpace: "pre-wrap" }}>
              {sel.bodyText || "(no plain-text body)"}
            </p>
          </div>
        </div>

        <AttachmentList attachments={sel.attachments} />
      </div>

      <div className="mail-reader-foot">
        <button
          className="btn"
          disabled={setStatus.isPending || sel.status === "read"}
          onClick={markRead}
        >
          <Icons.Eye size={13} /> Mark read
        </button>
        <button
          className="btn"
          disabled={setStatus.isPending || sel.status === "archived"}
          onClick={archive}
        >
          <Icons.Inbox size={13} /> Archive
        </button>
      </div>
    </div>
  )
}

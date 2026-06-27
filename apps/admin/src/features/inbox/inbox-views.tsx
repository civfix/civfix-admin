"use client"

import * as React from "react"
import {
  INBOUND_EMAIL_STATUS_LABELS,
  relativeAgo,
  type InboundEmailListItemDTO,
  type InboundEmailStatus,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { useInboxMessage, useSetInboxStatus } from "@/features/inbox/use-inbox"
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
  item: InboundEmailListItemDTO
  selected: boolean
  onClick: () => void
}) {
  return (
    <div
      className={`mail-row ${selected ? "selected" : ""} ${item.unread ? "unread" : ""}`}
      onClick={onClick}
    >
      <span className="mail-dir in">
        <Icons.ArrowDown size={13} />
      </span>
      <div className="mail-row-body">
        <div className="mail-row-top">
          <span className="mail-from">{item.from || "(unknown sender)"}</span>
          <span className="mail-ts mono" title={new Date(item.ts).toLocaleString()}>
            {relativeAgo(item.ts)}
          </span>
        </div>
        <div className="mail-subject">
          {item.subject || "(no subject)"}
          {item.hasAttachments && (
            <span className="mono" title="has attachments" style={{ marginLeft: 6, opacity: 0.6 }}>
              <Icons.ExternalLink size={11} />
            </span>
          )}
        </div>
        <div className="mail-preview">
          <span className="mono" style={{ opacity: 0.6 }}>
            {item.localPart || item.recipient}
          </span>{" "}
          {item.preview}
        </div>
      </div>
      <span className={`pill ${STATUS_CLS[item.status]} tight mail-status-pill`}>
        {INBOUND_EMAIL_STATUS_LABELS[item.status]}
      </span>
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

        {sel.attachments.length > 0 && (
          <div className="mail-attachments">
            {sel.attachments.map((att) => (
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

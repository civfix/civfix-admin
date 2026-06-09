"use client"

import * as React from "react"
import {
  INBOUND_EMAIL_STATUS_LABELS,
  type InboundEmailListItemDTO,
  type InboundEmailStatus,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { useInboxList, useInboxMessage, useSetInboxStatus } from "@/features/inbox/use-inbox"
import { useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Inbox — catch-all *@civfix.org mail that is NOT an outreach reply (support@, cold inbound, etc.). A
 * master-detail of the list (listInbox) + a reader (getInboxMessage). Triage only: mark read / archive
 * (setInboxStatus); replies to outreach thread into the Mail section instead. Ported from the Mail page's
 * shell + reused page primitives / CSS; the reader renders the plain-text body (we never inject raw HTML).
 */

/** Pill treatment per inbox status. */
const STATUS_CLS: Record<InboundEmailStatus, string> = {
  unread: "status-flag",
  read: "status-ok",
  archived: "status-progress",
}

/** The list-card title per selected box. */
const BOX_LABEL: Record<string, string> = {
  all: "All inbox",
  unread: "Unread",
  archived: "Archived",
}

function InboxRow({
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
          <span className="mail-ts mono">{item.ts}</span>
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

function InboxReader({ id }: { id: string }) {
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
        <button className="btn" disabled={setStatus.isPending || sel.status === "read"} onClick={markRead}>
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

export function InboxPage({ focusId }: SectionPageProps) {
  const [box, setBox] = React.useState("all")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const setStatus = useSetInboxStatus()

  const listParams = {
    status: box === "unread" ? ("unread" as const) : box === "archived" ? ("archived" as const) : ("all" as const),
  }
  const listQuery = useInboxList(listParams)
  const items = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data])

  // Unfiltered fetch for stable chip counts.
  const allQuery = useInboxList({ status: "all" })
  const allItems = React.useMemo(() => allQuery.data?.items ?? [], [allQuery.data])
  const counts = {
    all: allItems.length,
    unread: allItems.filter((i) => i.unread).length,
    archived: allItems.filter((i) => i.status === "archived").length,
  }

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.id)
    if (selId && items.length && !items.some((x) => x.id === selId)) setSelId(items[0]!.id)
  }, [items, selId])

  const selectMessage = (id: string) => {
    setSelId(id)
    const row = items.find((i) => i.id === id)
    if (row?.unread) setStatus.mutate({ id, status: "read" })
  }

  return (
    <>
      <PageHead
        title="Inbox"
        subtitle={
          <span>
            Catch-all mail to <span className="mono">*@civfix.org</span> — support requests and cold
            inbound. Outreach replies thread into Mail instead.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "unread", label: "Unread", count: counts.unread },
            { value: "archived", label: "Archived", count: counts.archived },
          ]}
          value={box}
          onChange={setBox}
        />
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>{BOX_LABEL[box] ?? "All inbox"}</h3>
            <div className="spacer" />
            <span className="meta">{items.length}</span>
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading inbox..." />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState title="Empty" sub="No messages here." icon={<Icons.Inbox size={20} />} />
            ) : (
              items.map((i) => (
                <InboxRow
                  key={i.id}
                  item={i}
                  selected={selId === i.id}
                  onClick={() => selectMessage(i.id)}
                />
              ))
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            <InboxReader key={selId} id={selId} />
          ) : (
            <EmptyState title="No message selected" icon={<Icons.Inbox size={20} />} />
          )}
        </section>
      </div>
    </>
  )
}

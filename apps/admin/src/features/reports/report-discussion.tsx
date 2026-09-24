"use client"

import * as React from "react"
import { MESSAGE_BODY_MAX, type ChatMessageDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog } from "@/components/shared/dialog"
import { ChatMessageRow, ChatSystemRow } from "@/features/reports/report-chat-rows"
import { sortChatOldestFirst } from "@/features/reports/report-chat"
import { SubmitShortcutHint, SUBMIT_KEYSHORTCUTS } from "@/features/reports/submit-shortcut"
import {
  useRemoveReportMessage,
  useReportChatHistory,
  useSendReportMessage,
} from "@/features/reports/use-reports"

const CHAT_COMPOSER_ROWS = 3

type ChatQuery = ReturnType<typeof useReportChatHistory>

function ChatThread({
  reportId,
  chatQuery,
  items,
}: {
  reportId: string
  chatQuery: ChatQuery
  items: ChatMessageDTO[]
}) {
  const removeMutation = useRemoveReportMessage()

  const onRemove = async (msg: ChatMessageDTO) => {
    const ok = await confirmDialog({
      title: "Remove message",
      body: "This soft-deletes the message from the report chat. Operators still see it as removed.",
      danger: true,
      confirmLabel: "Remove",
    })
    if (!ok) return
    removeMutation.mutate({ id: reportId, messageId: msg.id })
  }

  if (chatQuery.isLoading) return <LoadingState label="Loading chat..." />
  if (chatQuery.isError) {
    return <ErrorState error={chatQuery.error} onRetry={() => chatQuery.refetch()} />
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="No messages yet"
        sub="Messages neighbors post in this report's chat appear here."
        icon={<Icons.MessageSquare size={20} />}
      />
    )
  }
  return (
    <div className="dsc-list">
      {chatQuery.hasNextPage && (
        <button
          type="button"
          className="btn sm ghost full"
          disabled={chatQuery.isFetchingNextPage}
          onClick={() => chatQuery.fetchNextPage()}
        >
          {chatQuery.isFetchingNextPage ? "Loading…" : "Load older messages"}
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
            removing={removeMutation.isPending}
            refreshPhotos={() => void chatQuery.refetch()}
          />
        ),
      )}
    </div>
  )
}

function ChatComposer({
  reportId,
  cityDept,
  hasCityContact,
}: {
  reportId: string
  cityDept: string
  hasCityContact: boolean
}) {
  const sendMutation = useSendReportMessage()
  const [draft, setDraft] = React.useState("")
  const hasDraft = !!draft.trim()

  const onSend = () => {
    const body = draft.trim()
    if (!body || sendMutation.isPending) return
    sendMutation.mutate({ id: reportId, body }, { onSuccess: () => setDraft("") })
  }

  return (
    <div className="dsc-composer">
      <textarea
        className="rep-followup"
        rows={CHAT_COMPOSER_ROWS}
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
          className={`btn ${hasDraft ? "primary" : ""}`}
          disabled={!hasDraft || sendMutation.isPending}
          style={!hasDraft ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
          onClick={onSend}
        >
          <Icons.Send size={13} /> Post <SubmitShortcutHint />
        </button>
      </div>
    </div>
  )
}

// Operators moderate and post in the same public thread neighbors see. Remove is a soft-delete offered
// only on authored rows: a system status event has no author to remove.
export function ReportDiscussion({
  reportId,
  cityDept,
  hasCityContact,
}: {
  reportId: string
  cityDept: string
  hasCityContact: boolean
}) {
  const chatQuery = useReportChatHistory(reportId)

  // Oldest first, matching the order neighbors see in the chat.
  const items = React.useMemo(
    () => sortChatOldestFirst(chatQuery.data?.pages.flatMap((p) => p.items) ?? []),
    [chatQuery.data],
  )

  return (
    <div className="sub">
      <div className="sub-head">
        Chat
        {!chatQuery.isLoading && !chatQuery.isError && (
          <span className="rep-confirms" style={{ marginLeft: "auto" }}>
            <Icons.MessageSquare size={12} /> {items.length}
            {chatQuery.hasNextPage ? "+" : ""}
          </span>
        )}
      </div>
      <div className="sub-body">
        <ChatThread reportId={reportId} chatQuery={chatQuery} items={items} />
      </div>
      <ChatComposer reportId={reportId} cityDept={cityDept} hasCityContact={hasCityContact} />
    </div>
  )
}

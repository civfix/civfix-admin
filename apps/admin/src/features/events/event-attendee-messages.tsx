"use client"

import * as React from "react"
import { PostMessageRequestSchema, type AdminEventDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { usePostEventMessage } from "@/features/events/use-events"
import { pluralize } from "@/features/reports/plural"
import { SubmitShortcutHint, SUBMIT_KEYSHORTCUTS } from "@/features/reports/submit-shortcut"

const ATTENDEE_MESSAGE_MAX = PostMessageRequestSchema.shape.body.maxLength ?? undefined
const ATTENDEE_UPDATE_ROWS = 2

function SentMessages({ messages }: { messages: AdminEventDTO["messages"] }) {
  return (
    <div className="evt-msgs">
      {messages.map((m, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className="evt-msg"
        >
          <span className="evt-msg-who">{m.who}</span>
          <span className="evt-msg-text">{m.text}</span>
          <span className="evt-msg-when">{m.when}</span>
        </div>
      ))}
    </div>
  )
}

export function useAttendeeUpdate() {
  const postMutation = usePostEventMessage()
  const [updateDraft, setUpdateDraft] = React.useState("")
  return { postMutation, updateDraft, setUpdateDraft }
}

export function EventAttendeeMessages({
  event,
  update,
}: {
  event: AdminEventDTO
  update: ReturnType<typeof useAttendeeUpdate>
}) {
  const { postMutation, updateDraft, setUpdateDraft } = update
  const noAttendees = event.attendees === 0
  const blocked = noAttendees || !updateDraft.trim()

  const send = () => {
    const body = updateDraft.trim()
    if (!body || postMutation.isPending) return
    postMutation.mutate({ id: event.id, body }, { onSuccess: () => setUpdateDraft("") })
  }

  return (
    <div className="sub">
      <div className="sub-head">Message attendees</div>
      <div className="sub-body">
        {event.messages.length > 0 && <SentMessages messages={event.messages} />}
        <textarea
          className="rep-followup"
          rows={ATTENDEE_UPDATE_ROWS}
          placeholder={
            noAttendees
              ? "No attendees to message yet"
              : `Post an update to ${pluralize(event.attendees, "attendee")}…`
          }
          aria-label="Update for attendees"
          aria-keyshortcuts={SUBMIT_KEYSHORTCUTS}
          maxLength={ATTENDEE_MESSAGE_MAX}
          value={updateDraft}
          disabled={noAttendees}
          onChange={(e) => setUpdateDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button
          className="btn primary full"
          disabled={blocked || postMutation.isPending}
          onClick={send}
          style={blocked ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
        >
          <Icons.Send size={13} /> Post update <SubmitShortcutHint />
        </button>
        <div className="evt-post-hint">Updates are posted as CivFix, not from your own account.</div>
      </div>
    </div>
  )
}

"use client"

import type {
  AdminBroadcastListItemDTO,
  BroadcastKind,
  BroadcastStatus,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { formatDateTime } from "@/lib/dates"
import { useNav } from "@/store/ui-store"

export const BROADCAST_STATUS_VIEW: Record<BroadcastStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "priority-low" },
  scheduled: { label: "Scheduled", cls: "status-new" },
  sending: { label: "Sending", cls: "status-progress" },
  sent: { label: "Sent", cls: "status-ok" },
  cancelled: { label: "Cancelled", cls: "priority-low" },
  failed: { label: "Failed", cls: "status-flag" },
}

export const BROADCAST_KIND_LABEL: Record<BroadcastKind, string> = {
  host_broadcast: "Host broadcast",
  confirmation: "Confirmation",
  waitlist_promoted: "Waitlist promoted",
  reminder: "Reminder",
  event_updated: "Event updated",
  event_cancelled: "Event cancelled",
  thank_you: "Thank you",
  announcement: "Announcement",
}

export function BroadcastLog({ items }: { items: AdminBroadcastListItemDTO[] }) {
  const nav = useNav()
  if (items.length === 0) {
    return (
      <EmptyState
        title="No broadcasts logged"
        sub="Nothing has been sent from this host in the selected window."
        icon={<Icons.Send size={20} />}
      />
    )
  }
  return (
    <div className="bcast-log">
      {items.map((item) => {
        const view = BROADCAST_STATUS_VIEW[item.status]
        return (
          <div key={item.id} className="bcast-row">
            <div className="bcast-top">
              <span className="bcast-kind">{BROADCAST_KIND_LABEL[item.kind]}</span>
              <span className={`pill ${view.cls} tight`}>{view.label}</span>
              <div className="spacer" />
              <span className="age">{formatDateTime(item.createdAt)}</span>
            </div>
            <div className="bcast-meta">
              <button
                type="button"
                className="lnk-inline"
                title="Open the event"
                onClick={() => nav("events", item.cleanupId)}
              >
                {item.eventTitle ?? "Event"}
              </button>
              <span className="sep">·</span>
              <span>{item.channels.length > 0 ? item.channels.join(", ") : "no channel"}</span>
              <span className="sep">·</span>
              <span>
                <b>{item.recipientCount.toLocaleString()}</b> recipients
              </span>
              <span className="sep">·</span>
              <span>
                <b>{item.sentCount.toLocaleString()}</b> sent
              </span>
              {item.failedCount > 0 && (
                <>
                  <span className="sep">·</span>
                  <span className="tone-alert">
                    <b>{item.failedCount.toLocaleString()}</b> failed
                  </span>
                </>
              )}
              {item.suppressedCount > 0 && (
                <>
                  <span className="sep">·</span>
                  <span>
                    <b>{item.suppressedCount.toLocaleString()}</b> suppressed
                  </span>
                </>
              )}
            </div>
            <div className="bcast-hash mono">
              subject hash {item.subjectHash ?? "—"} · finished {formatDateTime(item.finishedAt)}
            </div>
          </div>
        )
      })}
      <div className="bcast-note">
        <Icons.Lock size={12} /> This log is content-free by design: civfix records counts and a
        subject hash, never a subject line, a body or a recipient address.
      </div>
    </div>
  )
}

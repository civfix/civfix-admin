"use client"

import type { LinkedEventRef } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { formatDate } from "@/lib/dates"
import { firstName } from "@/lib/display"
import { eventKindView } from "@/lib/event-kind"
import { useNav } from "@/store/ui-store"

function LinkedEventCard({ event, onOpen }: { event: LinkedEventRef; onOpen: () => void }) {
  const view = eventKindView(event.eventKind)
  const KindIcon = view.icon
  return (
    <button className="evt-linked-card" onClick={onOpen} title={event.title}>
      <span className="evt-linked-thumb hue-sun" aria-hidden="true">
        <KindIcon size={16} />
      </span>
      <span className="evt-linked-body">
        <span className="evt-linked-title">{event.title}</span>
        <span className="evt-linked-sub">
          <span className="evt-linked-cat">{view.label}</span>
          <span className="sep">·</span>
          <span>{formatDate(event.scheduledAt)}</span>
          <span className="sep">·</span>
          <span>{`${event.going} going`}</span>
        </span>
        <span className="evt-linked-addr">{firstName(event.organizer.name)}</span>
      </span>
    </button>
  )
}

export function ReportLinkedEvents({ events }: { events: LinkedEventRef[] }) {
  const nav = useNav()
  return (
    <div className="sub">
      <div className="sub-head">
        Linked events
        <span className="rep-confirms" style={{ marginLeft: "auto" }}>
          <Icons.Calendar size={12} /> {events.length}
        </span>
      </div>
      <div className="sub-body">
        <div className="evt-linked-list">
          {events.map((e) => (
            <LinkedEventCard key={e.id} event={e} onOpen={() => nav("events", e.id)} />
          ))}
        </div>
      </div>
    </div>
  )
}

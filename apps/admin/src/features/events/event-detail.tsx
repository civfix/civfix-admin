"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import type { AdminEventDTO } from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog } from "@/components/shared/dialog"
import { cancelBlockedFor, eventStatusView } from "@/lib/event-status"
import { eventKindView, EVENT_KIND_PIN_KIND } from "@/lib/event-kind"
import { EventAttendeeMessages, useAttendeeUpdate } from "@/features/events/event-attendee-messages"
import { shortId } from "@/features/events/event-id"
import { EventLinkedReports } from "@/features/events/event-linked-reports"
import { EventOrganizerCard } from "@/features/events/event-organizer-card"
import { EventTurnoutCard, useOutcomeDraft } from "@/features/events/event-turnout-card"
import { LinkReportsPicker } from "@/features/events/link-reports-picker"
import {
  useCancelEvent,
  useEvent,
  useFlagEvent,
  useLinkReports,
  useUnlinkReport,
} from "@/features/events/use-events"

const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="pi-map-canvas" aria-busy="true" />,
})

const EVENT_MINIMAP_ZOOM = 13
const MINIMAP_PIN_ID = "e"

type EventTimelineItem = AdminEventDTO["timeline"][number]

const TIMELINE_ICON: Record<EventTimelineItem["kind"], IconComponent> = {
  create: Icons.Pin,
  status: Icons.Clock,
  join: Icons.Users,
  message: Icons.Mail,
  done: Icons.Check,
  warn: Icons.AlertTriangle,
  cancel: Icons.Trash,
  linked: Icons.Layers,
  unlinked: Icons.X,
}

function EventHead({ event }: { event: AdminEventDTO }) {
  const statusPill = eventStatusView(event.status)
  return (
    <div className="rep-head">
      <span className="rep-head-pin">
        <span className="evt-head-ico hue-sun">
          <Icons.Calendar size={18} />
        </span>
      </span>
      <div className="rep-head-text">
        <div className="crumb" title={event.id}>
          {shortId(event.id)} · {eventKindView(event.eventKind).label}
        </div>
        <h2>{event.title}</h2>
      </div>
      {event.flagged && (
        <span className="pill status-flag" style={{ marginLeft: "auto" }}>
          <Icons.Flag size={11} /> Flagged
        </span>
      )}
      <span
        className={`pill ${statusPill.cls}`}
        style={event.flagged ? undefined : { marginLeft: "auto" }}
      >
        {statusPill.label}
      </span>
    </div>
  )
}

function EventAbout({ event }: { event: AdminEventDTO }) {
  return (
    <div className="sub">
      <div className="sub-head">
        About
        <span className="rep-confirms" style={{ marginLeft: "auto" }}>
          <Icons.Users size={12} /> {event.attendees} attending
        </span>
      </div>
      <div className="sub-body">
        <p className="rep-desc">{event.desc}</p>
        <div className="rep-loc">
          <span className="rep-loc-item">
            <Icons.Pin size={13} /> {event.address}
          </span>
          <span className="rep-loc-sep">·</span>
          <span className="rep-loc-item">
            <Icons.Calendar size={13} /> {event.date.abs}
          </span>
        </div>
      </div>
    </div>
  )
}

function EventMeetLocation({ event }: { event: AdminEventDTO }) {
  return (
    <div className="sub">
      <div className="sub-head">Meet location</div>
      <div className="sub-body" style={{ padding: 10 }}>
        <div className="rep-media">
          <div className="rep-minimap" style={{ flex: 1 }}>
            <LeafletMap
              pins={[
                {
                  id: MINIMAP_PIN_ID,
                  category: "event",
                  kind: EVENT_KIND_PIN_KIND[event.eventKind],
                  lat: event.coords[0],
                  lng: event.coords[1],
                },
              ]}
              center={event.coords}
              zoom={EVENT_MINIMAP_ZOOM}
              tint="voyager"
              interactive={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineRow({ item }: { item: EventTimelineItem }) {
  const TimelineIcon = TIMELINE_ICON[item.kind] ?? Icons.Clock
  return (
    <div className={`rep-tl-row kind-${item.kind}`}>
      <span className="rep-tl-ico">
        <TimelineIcon size={12} />
      </span>
      <div className="rep-tl-body">
        <div className="rep-tl-text">
          <b>{item.who}</b> {item.what}
        </div>
        <div className="rep-tl-when">{item.when}</div>
      </div>
    </div>
  )
}

function EventActivity({ timeline }: { timeline: EventTimelineItem[] }) {
  return (
    <div className="sub">
      <div className="sub-head">Activity</div>
      <div className="sub-body">
        {timeline.length === 0 ? (
          <EmptyState title="No activity yet" icon={<Icons.Clock size={20} />} />
        ) : (
          <div className="rep-timeline">
            {timeline.map((t, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <TimelineRow key={i} item={t} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function useEventModeration() {
  const flagMutation = useFlagEvent()
  const cancelMutation = useCancelEvent()
  return { flagMutation, cancelMutation }
}

function EventModerateBar({
  event,
  moderation,
}: {
  event: AdminEventDTO
  moderation: ReturnType<typeof useEventModeration>
}) {
  const { flagMutation, cancelMutation } = moderation
  const cancelBlockedId = React.useId()
  const cancelBlockedReason = cancelBlockedFor(event.status)

  const onCancel = async () => {
    const ok = await confirmDialog({
      title: "Cancel this event?",
      body: "Attendees will be notified that the event is cancelled. This can't be undone.",
      danger: true,
      confirmLabel: "Cancel event",
      cancelLabel: "Keep event",
    })
    if (!ok) return
    cancelMutation.mutate({ id: event.id })
  }

  return (
    <>
      <div className="rep-actions">
        <span className="rep-actions-label">Moderate</span>
        <div className="spacer" />
        <button
          className={`btn ${event.flagged ? "flag-on" : ""}`}
          disabled={flagMutation.isPending}
          onClick={() => flagMutation.mutate({ id: event.id })}
        >
          <Icons.Flag size={13} /> {event.flagged ? "Flagged" : "Flag"}
        </button>
        <button
          className="btn danger"
          disabled={cancelMutation.isPending || cancelBlockedReason !== null}
          aria-describedby={cancelBlockedReason ? cancelBlockedId : undefined}
          onClick={onCancel}
        >
          <Icons.Trash size={13} /> Cancel event
        </button>
      </div>
      {cancelBlockedReason && (
        <div id={cancelBlockedId} className="evt-post-hint">
          {cancelBlockedReason}
        </div>
      )}
    </>
  )
}

export function EventDetail({ eventId }: { eventId: string }) {
  const eventQuery = useEvent(eventId)
  // Drafts and mutations live above the loading and error returns: a failed detail refetch must not
  // clear a typed update or re-enable a button whose request is still in flight.
  const moderation = useEventModeration()
  const update = useAttendeeUpdate()
  const outcome = useOutcomeDraft()
  const linkReports = useLinkReports()
  const unlinkMutation = useUnlinkReport()
  const [pickerOpen, setPickerOpen] = React.useState(false)

  if (eventQuery.isLoading) return <LoadingState label="Loading event..." />
  if (eventQuery.isError) {
    return <ErrorState error={eventQuery.error} onRetry={() => eventQuery.refetch()} />
  }
  const event = eventQuery.data
  if (!event) {
    return (
      <EmptyState
        title="No event selected"
        sub="Pick an event from the list."
        icon={<Icons.Calendar size={20} />}
      />
    )
  }

  const isCleanup = event.eventKind === "cleanup"

  const onLink = (reportIds: string[]) => {
    linkReports.mutate({ id: event.id, reportIds }, { onSuccess: () => setPickerOpen(false) })
  }

  return (
    <div className="rep-detail">
      <EventHead event={event} />

      <div className="rep-grid">
        <div className="rep-col">
          <EventAbout event={event} />
          <EventMeetLocation event={event} />
          <EventActivity timeline={event.timeline} />
          {isCleanup && (
            <EventLinkedReports
              event={event}
              linking={linkReports.isPending}
              unlinkMutation={unlinkMutation}
              onOpenPicker={() => setPickerOpen(true)}
            />
          )}
        </div>

        <div className="rep-col">
          <EventTurnoutCard event={event} outcome={outcome} />
          <EventOrganizerCard organizer={event.organizer} />
          <EventAttendeeMessages event={event} update={update} />
        </div>
      </div>

      <EventModerateBar event={event} moderation={moderation} />

      {pickerOpen && isCleanup && (
        <LinkReportsPicker
          excludeIds={new Set(event.linkedReports.map((r) => r.id))}
          pending={linkReports.isPending}
          onClose={() => setPickerOpen(false)}
          onLink={onLink}
        />
      )}
    </div>
  )
}

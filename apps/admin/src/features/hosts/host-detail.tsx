"use client"

import * as React from "react"
import type { AdminBroadcastListItemDTO, AdminHostListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { LoadMoreButton } from "@/components/shared/section-list"
import { promptDialog } from "@/components/shared/dialog"
import { formatDateTime } from "@/lib/dates"
import { flatPages } from "@/lib/infinite"
import { BroadcastLog } from "@/features/hosts/broadcast-log"
import {
  eventsFromBroadcasts,
  hostBroadcastParams,
  type HostActivityWindow,
  type HostEventRef,
} from "@/features/hosts/host-window"
import { useBroadcastListInfinite, useSetHostMessagingSuspended } from "@/features/hosts/use-hosts"
import { useNav } from "@/store/ui-store"

type BroadcastLogQuery = ReturnType<typeof useBroadcastListInfinite>

function HostDetailHead({ row }: { row: AdminHostListItemDTO }) {
  const suspended = row.messagingSuspended
  return (
    <div className="rep-head">
      <span className="rep-head-pin">
        <span className="evt-head-ico hue-bloom">
          <Icons.Send size={18} />
        </span>
      </span>
      <div className="rep-head-text">
        <div className="crumb">{row.host.handle}</div>
        <h2>{row.host.name}</h2>
      </div>
      <span
        className={`pill ${suspended ? "status-flag" : "status-ok"}`}
        style={{ marginLeft: "auto" }}
      >
        {suspended ? (
          <>
            <Icons.Lock size={11} /> Messaging suspended
          </>
        ) : (
          <>
            <Icons.Check size={11} /> Messaging active
          </>
        )}
      </span>
    </div>
  )
}

function HostKpis({ row }: { row: AdminHostListItemDTO }) {
  return (
    <div className="statusstrip kpi-strip">
      <div className="statcell">
        <div className="statcell-label">Broadcasts</div>
        <div className="statcell-num">{row.broadcastCount.toLocaleString()}</div>
        <div className="statcell-hot">last {row.windowDays} days</div>
      </div>
      <div className="statcell">
        <div className="statcell-label">Recipients</div>
        <div className="statcell-num">{row.recipientCount.toLocaleString()}</div>
        <div className="statcell-hot">resolved audience</div>
      </div>
      <div className="statcell tone-ok">
        <div className="statcell-label">Sent</div>
        <div className="statcell-num">{row.sentCount.toLocaleString()}</div>
        <div className="statcell-hot">delivered to a channel</div>
      </div>
      <div className={`statcell ${row.failedCount > 0 ? "tone-alert" : ""}`}>
        <div className="statcell-label">Failed</div>
        <div className="statcell-num">{row.failedCount.toLocaleString()}</div>
        <div className="statcell-hot">{row.suppressedCount.toLocaleString()} suppressed</div>
      </div>
    </div>
  )
}

function BroadcastLogSection({
  logQuery,
  broadcasts,
}: {
  logQuery: BroadcastLogQuery
  broadcasts: AdminBroadcastListItemDTO[]
}) {
  return (
    <div className="sub">
      <div className="sub-head">
        Broadcast log
        <span className="rep-confirms" style={{ marginLeft: "auto" }}>
          <Icons.Layers size={12} /> {broadcasts.length}
        </span>
      </div>
      <div className="sub-body">
        {logQuery.isLoading ? (
          <LoadingState label="Loading the broadcast log..." />
        ) : logQuery.isError ? (
          <ErrorState
            error={logQuery.error}
            onRetry={() => logQuery.refetch()}
            title="Could not load this host's broadcasts"
          />
        ) : (
          <>
            <BroadcastLog items={broadcasts} />
            <LoadMoreButton query={logQuery} className="load-more" label="Load more broadcasts" />
          </>
        )}
      </div>
    </div>
  )
}

function EventsReachedList({
  logQuery,
  events,
}: {
  logQuery: BroadcastLogQuery
  events: HostEventRef[]
}) {
  const nav = useNav()
  if (logQuery.isLoading) return <LoadingState label="Reading the broadcast log..." />
  if (logQuery.isError) {
    return (
      <EmptyState
        title="No events to show"
        sub="The broadcast log did not load. Try again above to see which events this host messaged."
        icon={<Icons.Calendar size={20} />}
      />
    )
  }
  if (events.length === 0) {
    return (
      <EmptyState
        title="No events in the loaded log"
        sub="Load more of the broadcast log to see which events this host messaged."
        icon={<Icons.Calendar size={20} />}
      />
    )
  }
  return (
    <div className="host-events">
      {events.map((event) => (
        <button
          key={event.cleanupId}
          type="button"
          className="btn sm ghost"
          onClick={() => nav("events", event.cleanupId)}
        >
          <Icons.Calendar size={12} /> {event.title}
        </button>
      ))}
    </div>
  )
}

function EventsReachedSection({
  row,
  logQuery,
  events,
}: {
  row: AdminHostListItemDTO
  logQuery: BroadcastLogQuery
  events: HostEventRef[]
}) {
  return (
    <div className="sub">
      <div className="sub-head">
        Events reached
        <span className="rep-confirms" style={{ marginLeft: "auto" }}>
          <Icons.Calendar size={12} /> {row.eventsMessaged.toLocaleString()}
        </span>
      </div>
      <div className="sub-body">
        <EventsReachedList logQuery={logQuery} events={events} />
      </div>
    </div>
  )
}

function HostMessagingActions({ row }: { row: AdminHostListItemDTO }) {
  const suspend = useSetHostMessagingSuspended()
  const suspended = row.messagingSuspended

  const onToggleSuspended = async () => {
    const next = !suspended
    const reason = await promptDialog({
      title: next
        ? `Suspend messaging for ${row.host.name}?`
        : `Restore messaging for ${row.host.name}?`,
      body: next
        ? "Every broadcast this host composes, schedules or sends is refused until messaging is restored. In-flight sends stop mid-chunk. The reason is written to the audit log."
        : "The host can compose and send broadcasts again, subject to the normal caps. The reason is written to the audit log.",
      label: "Reason (required)",
      placeholder: next
        ? "Repeated off-topic broadcasts to event attendees…"
        : "Reviewed with the host; the pattern has stopped…",
      confirmLabel: next ? "Suspend messaging" : "Restore messaging",
      required: true,
      danger: next,
    })
    if (reason === null || reason.trim() === "") return
    suspend.mutate({
      request: { id: row.host.id, suspended: next, reason: reason.trim() },
      hostName: row.host.name,
    })
  }

  return (
    <div className="rep-actions">
      <span className="rep-actions-label">Messaging</span>
      <div className="spacer" />
      <button
        type="button"
        className={`btn ${suspended ? "" : "danger"}`}
        disabled={suspend.isPending}
        onClick={() => void onToggleSuspended()}
      >
        {suspended ? (
          <>
            <Icons.Check size={13} /> Restore messaging
          </>
        ) : (
          <>
            <Icons.Lock size={13} /> Suspend messaging
          </>
        )}
      </button>
    </div>
  )
}

export function HostDetail({
  row,
  activityWindow,
}: {
  row: AdminHostListItemDTO
  activityWindow: HostActivityWindow
}) {
  const logParams = React.useMemo(
    () => hostBroadcastParams(row.host.id, activityWindow),
    [row.host.id, activityWindow],
  )
  const logQuery = useBroadcastListInfinite(logParams)
  const broadcasts = React.useMemo(
    () => flatPages(logQuery.data),
    [logQuery.data],
  )
  const events = React.useMemo(() => eventsFromBroadcasts(broadcasts), [broadcasts])

  return (
    <div className="rep-detail">
      <HostDetailHead row={row} />

      {row.messagingSuspended && (
        <div className="pay-note tone-alert">
          <Icons.Lock size={13} /> Suspended {formatDateTime(row.suspendedAt)}
          {row.suspendedBy ? ` by ${row.suspendedBy.name}` : ""}. The mandatory reason is in the
          audit log.
        </div>
      )}

      <HostKpis row={row} />
      <BroadcastLogSection logQuery={logQuery} broadcasts={broadcasts} />
      <EventsReachedSection row={row} logQuery={logQuery} events={events} />
      <HostMessagingActions row={row} />
    </div>
  )
}

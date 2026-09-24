"use client"

import * as React from "react"
import type { AdminHostListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { promptDialog } from "@/components/shared/dialog"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { useDebounced } from "@/hooks/use-debounced"
import { formatDateTime } from "@/lib/dates"
import { BroadcastLog } from "@/features/hosts/broadcast-log"
import {
  HOST_ACTIVITY_WINDOW_DAYS,
  HOST_FILTERS,
  eventsFromBroadcasts,
  hostActivityWindow,
  hostBroadcastParams,
  hostListParams,
  type HostActivityWindow,
} from "@/features/hosts/host-window"
import {
  useAdminBroadcastsInfinite,
  useAdminHostsInfinite,
  useSetHostMessagingSuspended,
} from "@/features/hosts/use-hosts"
import { useNav, useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

const FILTER_LABEL: Record<(typeof HOST_FILTERS)[number], string> = {
  all: "All",
  active: "Active",
  suspended: "Suspended",
}

function HostRow({
  row,
  selected,
  onClick,
}: {
  row: AdminHostListItemDTO
  selected: boolean
  onClick: () => void
}) {
  return (
    <div
      className={`qrow ${selected ? "selected" : ""}`}
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
      <div className="leading">
        <span className="evt-row-ico hue-bloom" title="Host">
          <Icons.Send size={15} />
        </span>
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{row.host.name}</span>
          <span className="ident">{row.host.handle}</span>
          {row.messagingSuspended && (
            <span className="pill status-flag tight">
              <Icons.Lock size={10} /> Suspended
            </span>
          )}
        </div>
        <div className="sub">
          <span className="strong">{row.broadcastCount.toLocaleString()} broadcasts</span>
          <span className="sep">·</span>
          <span>{row.recipientCount.toLocaleString()} recipients</span>
          <span className="sep">·</span>
          <span>
            {row.eventsMessaged.toLocaleString()}{" "}
            {row.eventsMessaged === 1 ? "event" : "events"}
          </span>
        </div>
      </div>
      <div className="trailing">
        {row.failedCount > 0 && (
          <span className="pill status-flag tight">{row.failedCount} failed</span>
        )}
        <span className="age">{formatDateTime(row.lastBroadcastAt)}</span>
      </div>
    </div>
  )
}

function HostDetail({
  row,
  activityWindow,
}: {
  row: AdminHostListItemDTO
  activityWindow: HostActivityWindow
}) {
  const suspend = useSetHostMessagingSuspended()
  const toast = useToast()
  const nav = useNav()
  const logParams = React.useMemo(
    () => hostBroadcastParams(row.host.id, activityWindow),
    [row.host.id, activityWindow],
  )
  const logQuery = useAdminBroadcastsInfinite(logParams)
  const broadcasts = React.useMemo(
    () => logQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [logQuery.data],
  )
  const events = React.useMemo(() => eventsFromBroadcasts(broadcasts), [broadcasts])
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
    suspend.mutate(
      { id: row.host.id, suspended: next, reason: reason.trim() },
      {
        onSuccess: () =>
          toast(
            next
              ? `Messaging suspended · ${row.host.name}`
              : `Messaging restored · ${row.host.name}`,
          ),
      },
    )
  }

  return (
    <div className="rep-detail">
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

      {suspended && (
        <div className="pay-note tone-alert">
          <Icons.Lock size={13} /> Suspended {formatDateTime(row.suspendedAt)}
          {row.suspendedBy ? ` by ${row.suspendedBy.name}` : ""}. The mandatory reason is in the
          audit log.
        </div>
      )}

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
              {logQuery.hasNextPage && (
                <button
                  type="button"
                  className="btn load-more"
                  disabled={logQuery.isFetchingNextPage}
                  onClick={() => void logQuery.fetchNextPage()}
                >
                  {logQuery.isFetchingNextPage ? "Loading…" : "Load more broadcasts"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="sub">
        <div className="sub-head">
          Events reached
          <span className="rep-confirms" style={{ marginLeft: "auto" }}>
            <Icons.Calendar size={12} /> {row.eventsMessaged.toLocaleString()}
          </span>
        </div>
        <div className="sub-body">
          {logQuery.isLoading ? (
            <LoadingState label="Reading the broadcast log..." />
          ) : logQuery.isError ? (
            <EmptyState
              title="No events to show"
              sub="The broadcast log did not load. Try again above to see which events this host messaged."
              icon={<Icons.Calendar size={20} />}
            />
          ) : events.length === 0 ? (
            <EmptyState
              title="No events in the loaded log"
              sub="Load more of the broadcast log to see which events this host messaged."
              icon={<Icons.Calendar size={20} />}
            />
          ) : (
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
          )}
        </div>
      </div>

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
    </div>
  )
}

export function HostsPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)
  const [autoPick, setAutoPick] = React.useState(focusId === null)

  const debouncedQuery = useDebounced(query, 250)
  const activityWindow = React.useMemo(() => hostActivityWindow(), [])
  const listParams = React.useMemo(
    () => hostListParams(filter, debouncedQuery),
    [filter, debouncedQuery],
  )
  const listQuery = useAdminHostsInfinite(listParams)
  const rows = React.useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  )

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  // Only the first load picks a host on the operator's behalf. A pick that later drops out of the
  // list (a filter, a search, or a suspend under the Active chip) clears instead, so the action
  // buttons never land on a host nobody chose.
  React.useEffect(() => {
    if (!listQuery.isSuccess) return
    if (selId === null) {
      if (autoPick && rows.length) setSelId(rows[0]!.host.id)
      return
    }
    setAutoPick(false)
    if (selId !== focusId && !rows.some((r) => r.host.id === selId)) setSelId(null)
  }, [listQuery.isSuccess, rows, selId, focusId, autoPick])

  const selected = rows.find((r) => r.host.id === selId) ?? null
  const missingLink =
    selected === null && selId !== null && selId === focusId && listQuery.isSuccess

  return (
    <>
      <PageHead
        title="Host messaging"
        subtitle={
          <span>
            Every host who sent a broadcast in the last {HOST_ACTIVITY_WINDOW_DAYS} days, plus every host
            currently suspended, with server-computed delivery counters and their current messaging
            state. Automated lanes
            (confirmations, reminders, thank-yous) are excluded. Suspend a host and every broadcast
            stops immediately.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={HOST_FILTERS.map((value) => ({ value, label: FILTER_LABEL[value] }))}
          value={filter}
          onChange={setFilter}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            aria-label="Search hosts"
            placeholder="Search host name or handle…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Hosts</h3>
            <div className="spacer" />
            {listQuery.isSuccess && (
              <span className="meta">
                {rows.length}
                {listQuery.hasNextPage ? "+" : ""}
              </span>
            )}
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading hosts..." />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : (
              <>
                {rows.length === 0 ? (
                  <EmptyState
                    title="No hosts here"
                    sub={`No host matches this filter and search in the last ${HOST_ACTIVITY_WINDOW_DAYS} days.`}
                    icon={<Icons.Send size={20} />}
                  />
                ) : (
                  rows.map((row) => (
                    <HostRow
                      key={row.host.id}
                      row={row}
                      selected={selId === row.host.id}
                      onClick={() => setSelId(row.host.id)}
                    />
                  ))
                )}
                {listQuery.hasNextPage && (
                  <button
                    type="button"
                    className="btn load-more"
                    disabled={listQuery.isFetchingNextPage}
                    onClick={() => void listQuery.fetchNextPage()}
                  >
                    {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selected ? (
            <HostDetail
              key={selected.host.id}
              row={selected}
              activityWindow={activityWindow}
            />
          ) : missingLink ? (
            <EmptyState
              title="That host is not in this window"
              sub="civfix exposes hosts as a list of broadcast senders, not as a single-host read, so a linked host appears only once the loaded window contains them. Switch the chip to All, clear the search, or load more."
              icon={<Icons.Send size={20} />}
            />
          ) : (
            <EmptyState
              title="No host selected"
              sub="Pick a host from the list."
              icon={<Icons.Send size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

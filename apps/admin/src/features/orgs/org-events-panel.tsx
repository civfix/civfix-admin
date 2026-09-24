"use client"

import * as React from "react"
import type { AdminOrgDTO, AdminOrgEventWhen } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { EmptyState, FilterChips } from "@/components/shared/page-primitives"
import { eventKindView } from "@/lib/event-kind"
import { eventStatusView } from "@/lib/event-status"
import { useOrgEventsInfinite } from "@/features/orgs/use-orgs"
import { useNav } from "@/store/ui-store"

const WHEN_OPTIONS: { value: AdminOrgEventWhen; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
]

/** Events hosted under the org's name; a row opens the event in the Events section. */
export function OrgEventsPanel({ org }: { org: AdminOrgDTO }) {
  const [when, setWhen] = React.useState<AdminOrgEventWhen>("upcoming")
  const q = useOrgEventsInfinite(org.id, when)
  const nav = useNav()
  const items = React.useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data])

  return (
    <div className="org-panel">
      <div className="toolbar" style={{ padding: "0 2px" }}>
        <FilterChips
          options={WHEN_OPTIONS}
          value={when}
          onChange={(v) => setWhen(v as AdminOrgEventWhen)}
        />
        <div className="toolbar-spacer" />
        <span className="muted">{org.eventCount.toLocaleString()} hosted in total</span>
      </div>
      <div className="sub">
        <div className="sub-head">
          Events
          <span className="rep-confirms" style={{ marginLeft: "auto" }}>
            <Icons.Calendar size={12} /> {items.length.toLocaleString()}
            {q.hasNextPage ? "+" : ""}
          </span>
        </div>
        <div className="queue-list">
          {q.isLoading ? (
            <LoadingState label="Loading events..." />
          ) : q.isError && !q.data ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load events" />
          ) : items.length === 0 ? (
            <EmptyState
              title={when === "upcoming" ? "Nothing scheduled" : "No events here"}
              sub={
                when === "upcoming"
                  ? "This organization has no upcoming events."
                  : "No events match this filter."
              }
              icon={<Icons.Calendar size={20} />}
            />
          ) : (
            <>
              {items.map((item) => {
                const kind = eventKindView(item.eventKind)
                const KindIco = kind.icon
                const status = eventStatusView(item.status)
                return (
                  <div
                    key={item.id}
                    className="qrow"
                    role="button"
                    tabIndex={0}
                    title="Open in Events"
                    onClick={() => nav("events", item.id)}
                    onKeyDown={(e) => {
                      if (!isKeyboardActivationKey(e.key)) return
                      e.preventDefault()
                      nav("events", item.id)
                    }}
                  >
                    <div className="leading">
                      <span className="evt-row-ico hue-sun" title={kind.label}>
                        <KindIco size={15} />
                      </span>
                    </div>
                    <div className="body">
                      <div className="top">
                        <span className="title">{item.title}</span>
                        {item.flagged && (
                          <span className="rep-flag-dot" role="img" aria-label="Flagged" title="Flagged">
                            <Icons.Flag size={10} />
                          </span>
                        )}
                      </div>
                      <div className="sub">
                        <span className="strong">{item.place}</span>
                        <span className="sep">·</span>
                        <span>
                          {item.attendees}
                          {item.capacity !== null ? `/${item.capacity}` : ""} attending
                        </span>
                        <span className="sep">·</span>
                        <span>{item.organizer.name}</span>
                      </div>
                    </div>
                    <div className="trailing">
                      <span className={`pill ${status.cls} tight`}>{status.label}</span>
                      <span className="age">{item.date.abs}</span>
                      <Icons.ChevronRight size={14} className="row-arrow" />
                    </div>
                  </div>
                )
              })}
              {q.hasNextPage && (
                <button
                  type="button"
                  className="btn load-more"
                  disabled={q.isFetchingNextPage}
                  onClick={() => void q.fetchNextPage()}
                >
                  {q.isFetchingNextPage ? "Loading…" : "Load more"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

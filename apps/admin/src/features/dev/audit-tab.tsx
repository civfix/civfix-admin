"use client"

import * as React from "react"
import type { AuditLogEntryDTO } from "@civfix/contract"

import { EmptyState } from "@/components/shared/page-primitives"
import { ListCard, ListStates, LoadMoreButton, SearchBox } from "@/components/shared/section-list"
import { useDebounced } from "@/hooks/use-debounced"
import { useNow } from "@/hooks/use-now"
import { flatPages } from "@/lib/infinite"
import { Ago, NOT_SET } from "@/features/dev/dev-format"
import { auditListParams, useDevActivity, useDevAuditLog } from "@/features/dev/use-dev-audit"

const AUDIT_TITLE = "Audit log"
const HEADERS = ["When", "Operator", "Action", "Target"]
const EMPTY = <EmptyState title="Nothing here yet." />

function AuditRow({ entry, now }: { entry: AuditLogEntryDTO; now: number }) {
  return (
    <div className="trow dev-audit" role="row">
      <span role="cell">
        <Ago value={entry.createdAt} now={now} />
      </span>
      <span role="cell" className="td-strong">
        {entry.actorName ?? NOT_SET}
      </span>
      <span role="cell" className="mono">
        {entry.action}
      </span>
      <span role="cell" className="mono">
        {entry.target}
      </span>
    </div>
  )
}

function AuditLog() {
  const [action, setAction] = React.useState("")
  const [actor, setActor] = React.useState("")
  const debouncedAction = useDebounced(action)
  const debouncedActor = useDebounced(actor)
  const params = React.useMemo(
    () => auditListParams({ action: debouncedAction, actor: debouncedActor }),
    [debouncedAction, debouncedActor],
  )
  const audit = useDevAuditLog(params)
  const entries = React.useMemo(() => flatPages(audit.data), [audit.data])
  const now = useNow()

  return (
    <>
      <div className="toolbar">
        <SearchBox
          label="Filter by action"
          placeholder="Filter by action…"
          value={action}
          onChange={setAction}
        />
        <SearchBox
          label="Filter by operator"
          placeholder="Filter by operator name…"
          value={actor}
          onChange={setActor}
        />
      </div>
      <ListCard title={AUDIT_TITLE}>
        <ListStates
          query={audit}
          loadingLabel="Loading the audit log..."
          isEmpty={entries.length === 0}
          empty={EMPTY}
        >
          <div className="table-scroll">
            <div className="table" role="table" aria-label={AUDIT_TITLE}>
              <div className="trow thead dev-audit" role="row">
                {HEADERS.map((header) => (
                  <span key={header} role="columnheader">
                    {header}
                  </span>
                ))}
              </div>
              {entries.map((entry) => (
                <AuditRow key={entry.id} entry={entry} now={now} />
              ))}
            </div>
          </div>
          <LoadMoreButton query={audit} className="load-more" />
        </ListStates>
      </ListCard>
    </>
  )
}

function RecentActivity() {
  const activity = useDevActivity()
  const items = activity.data?.items ?? []

  return (
    <ListCard title="Recent activity">
      <ListStates
        query={activity}
        loadingLabel="Loading activity..."
        isEmpty={items.length === 0}
        empty={EMPTY}
      >
        <ul className="dev-activity">
          {/* Activity items carry no id, and the list is replaced whole on every load. */}
          {items.map((item, index) => (
            <li key={index}>
              <span className="dev-activity-when">{item.ts}</span>
              <span>
                <b>{item.who}</b> {item.what}
              </span>
            </li>
          ))}
        </ul>
      </ListStates>
    </ListCard>
  )
}

export function AuditTab() {
  return (
    <div className="dev-audit-stack">
      <AuditLog />
      <RecentActivity />
    </div>
  )
}

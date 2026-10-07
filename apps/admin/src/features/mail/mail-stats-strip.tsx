"use client"

import type { MailStatsResponse } from "@civfix/shared"
import type { UseQueryResult } from "@tanstack/react-query"

import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { EMPTY_VALUE } from "@/lib/empty-value"

function StatCell({
  className = "statcell",
  label,
  value,
  hint,
}: {
  className?: string
  label: string
  value: string | number
  hint: string
}) {
  return (
    <div className={className}>
      <div className="statcell-label">{label}</div>
      <div className="statcell-num">{value}</div>
      <div className="statcell-hot">{hint}</div>
    </div>
  )
}

function OutboundCells({ stats }: { stats: MailStatsResponse }) {
  if (stats.sent === 0 && stats.bounced === 0 && stats.failed === 0) {
    return (
      <StatCell label="Outbound · 7d" value={EMPTY_VALUE} hint="No outbound mail in the last 7 days" />
    )
  }
  return (
    <>
      <StatCell
        className="statcell tone-ok"
        label="Sent · 7d"
        value={stats.sent.toLocaleString()}
        hint="outbound to cities"
      />
      <StatCell
        className={`statcell ${stats.bounced > 0 ? "tone-alert" : ""}`}
        label="Bounced"
        value={stats.bounced.toLocaleString()}
        hint="last 7 days"
      />
      <StatCell
        className={`statcell ${stats.failed > 0 ? "tone-alert" : ""}`}
        label="Failed"
        value={stats.failed.toLocaleString()}
        hint="send rejected"
      />
    </>
  )
}

export function MailStatsStrip({ statsQuery }: { statsQuery: UseQueryResult<MailStatsResponse> }) {
  if (statsQuery.isLoading) {
    return (
      <div className="strip-state">
        <LoadingState label="Loading mail stats..." />
      </div>
    )
  }
  if (statsQuery.isError) {
    return (
      <div className="strip-state">
        <ErrorState error={statsQuery.error} onRetry={() => statsQuery.refetch()} />
      </div>
    )
  }
  const stats = statsQuery.data
  if (!stats) return null
  return (
    <div className="statusstrip mail-strip">
      <OutboundCells stats={stats} />
      <StatCell label="Unread" value={stats.unread} hint="awaiting reply" />
    </div>
  )
}

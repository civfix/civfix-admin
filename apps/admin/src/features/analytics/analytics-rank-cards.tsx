"use client"

import type { ReactNode } from "react"

import { INITIALS_MAX_LETTERS } from "@/lib/display"
import { EMPTY_VALUE } from "@/lib/empty-value"
import { AnalyticsCard } from "@/features/analytics/analytics-card"
import type {
  useAnalyticsTopContributors,
  useAnalyticsTopJurisdictions,
} from "@/features/analytics/use-analytics"

const GOOD_VALUE_STYLE = { color: "var(--moss-700)", fontWeight: 700 } as const

function initials(name: string): string {
  const letters = name
    .split(" ")
    .map((word) => word[0] ?? "")
    .slice(0, INITIALS_MAX_LETTERS)
    .join("")
    .toUpperCase()
  return letters || "?"
}

interface RankRow {
  key: string
  lead: ReactNode
  count: ReactNode
  good: ReactNode
}

function RankTable({
  label,
  variant,
  headers,
  rows,
}: {
  label: string
  variant: "jt" | "ct"
  headers: readonly [string, string, string]
  rows: RankRow[]
}) {
  return (
    <div className="table-scroll">
      <div className="table" role="table" aria-label={label}>
        <div className={`trow thead ${variant}`} role="row">
          {headers.map((header) => (
            <span key={header} role="columnheader">
              {header}
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div key={row.key} className={`trow ${variant}`} role="row">
            {row.lead}
            <span className="mono" role="cell">
              {row.count}
            </span>
            <span className="mono" role="cell" style={GOOD_VALUE_STYLE}>
              {row.good}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TopJurisdictionsCard({
  query,
}: {
  query: ReturnType<typeof useAnalyticsTopJurisdictions>
}) {
  return (
    <AnalyticsCard
      title="Top jurisdictions"
      meta="by pin volume"
      span2
      pad={false}
      query={query}
      isEmpty={(data) => data.rows.length === 0}
    >
      {(data) => (
        <RankTable
          label="Top jurisdictions"
          variant="jt"
          headers={["Jurisdiction", "Pins", "Resolved"]}
          rows={data.rows.map((jurisdiction, i) => ({
            key: `${jurisdiction.org}-${i}`,
            lead: (
              <span className="td-strong" role="cell">
                {jurisdiction.org}
              </span>
            ),
            count: jurisdiction.pins,
            good: <>{jurisdiction.resolved}%</>,
          }))}
        />
      )}
    </AnalyticsCard>
  )
}

export function TopContributorsCard({
  query,
}: {
  query: ReturnType<typeof useAnalyticsTopContributors>
}) {
  return (
    <AnalyticsCard
      title="Top contributors"
      meta="reports + cleanups"
      span2
      pad={false}
      query={query}
      isEmpty={(data) => data.rows.length === 0}
    >
      {(data) => (
        <RankTable
          label="Top contributors"
          variant="ct"
          headers={["Neighbor", "Reports", "Cleanups"]}
          rows={data.rows.map((contributor, i) => ({
            key: `${contributor.name}-${contributor.city}-${i}`,
            lead: (
              <span className="contrib-cell" role="cell">
                <span className="contrib-av">{initials(contributor.name)}</span>
                <span className="contrib-text">
                  <span className="td-strong">{contributor.name}</span>
                  <span className="contrib-city">{contributor.city || EMPTY_VALUE}</span>
                </span>
              </span>
            ),
            count: contributor.reports,
            good: contributor.cleanups,
          }))}
        />
      )}
    </AnalyticsCard>
  )
}

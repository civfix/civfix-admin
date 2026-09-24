"use client"

import type { ReactNode } from "react"
import { REPORT_CATEGORY_LABELS, type ReportCategory } from "@civfix/shared"

import { categoryCssVar } from "@/lib/category"
import { EMPTY_VALUE } from "@/lib/empty-value"
import { AnalyticsCard } from "@/features/analytics/analytics-card"
import type {
  useAnalyticsByCategory,
  useAnalyticsCoverage,
  useAnalyticsFunnel,
  useAnalyticsResolutionByCategory,
} from "@/features/analytics/use-analytics"

const HOURS_PER_DAY = 24

function humanizeHours(hours: number): string {
  if (hours <= 0) return EMPTY_VALUE
  if (hours < 1) return "<1h"
  const total = Math.round(hours)
  if (total < HOURS_PER_DAY) return `${total}h`
  const days = Math.floor(total / HOURS_PER_DAY)
  const remainingHours = total % HOURS_PER_DAY
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

function CategoryBarRow({
  cat,
  widthPct,
  value,
}: {
  cat: ReportCategory
  widthPct: number
  value: ReactNode
}) {
  return (
    <div className="cat-bd-row">
      <span className="cat-bd-dot" style={{ background: categoryCssVar(cat) }} />
      <span className="cat-bd-name">{REPORT_CATEGORY_LABELS[cat]}</span>
      <span className="cat-bd-track">
        <span style={{ width: `${widthPct}%`, background: categoryCssVar(cat) }} />
      </span>
      <span className="cat-bd-n mono">{value}</span>
    </div>
  )
}

export function ByCategoryCard({ query }: { query: ReturnType<typeof useAnalyticsByCategory> }) {
  return (
    <AnalyticsCard
      title="By category"
      meta="this month"
      query={query}
      isEmpty={(data) => data.rows.every((row) => row.count === 0)}
    >
      {(data) => (
        <div className="cat-breakdown">
          {data.rows.map((row) => (
            <CategoryBarRow key={row.cat} cat={row.cat} widthPct={row.pct} value={row.count} />
          ))}
        </div>
      )}
    </AnalyticsCard>
  )
}

export function FunnelCard({ query }: { query: ReturnType<typeof useAnalyticsFunnel> }) {
  return (
    <AnalyticsCard
      title="Report funnel"
      meta="pin → resolved"
      query={query}
      isEmpty={(data) => data.stages.length === 0}
    >
      {(data) => (
        <div className="funnel">
          {data.stages.map((stage, i) => (
            <div key={stage.stage} className="funnel-row">
              <div className="funnel-top">
                <span className="funnel-stage">{stage.stage}</span>
                <span className="funnel-n mono">{stage.count.toLocaleString()}</span>
              </div>
              <div className="funnel-track">
                <div
                  className="funnel-fill"
                  style={{
                    width: `${stage.pct}%`,
                    background: i === data.stages.length - 1 ? "var(--moss)" : "var(--bloom)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </AnalyticsCard>
  )
}

export function CoverageCard({ query }: { query: ReturnType<typeof useAnalyticsCoverage> }) {
  return (
    <AnalyticsCard
      title="Mapping coverage"
      meta="jurisdictions"
      query={query}
      isEmpty={(data) => data.mapped + data.needsMapping === 0}
    >
      {(data) => (
        <div className="coverage">
          <div className="coverage-num">
            <span className="coverage-pct">
              {data.pct}
              <span className="coverage-pctsign">%</span>
            </span>
            <span className="coverage-cap">routed &amp; live</span>
          </div>
          <div className="coverage-bar">
            <span className="coverage-fill" style={{ width: `${data.pct}%` }} />
          </div>
          <div className="coverage-legend">
            <span className="cl-item">
              <span className="dot" style={{ background: "var(--cat-trash)" }} />
              {data.mapped} mapped
            </span>
            <span className="cl-item">
              <span className="dot" style={{ background: "var(--bloom-600)" }} />
              {data.needsMapping} need mapping
            </span>
          </div>
        </div>
      )}
    </AnalyticsCard>
  )
}

export function ResolutionTimeCard({
  query,
}: {
  query: ReturnType<typeof useAnalyticsResolutionByCategory>
}) {
  return (
    <AnalyticsCard
      title="Median resolution time"
      meta="by report type"
      span2
      query={query}
      isEmpty={(data) => data.rows.every((row) => row.hours === 0)}
    >
      {(data) => {
        const maxHours = Math.max(...data.rows.map((row) => row.hours), 1)
        return (
          <div className="cat-breakdown">
            {data.rows.map((row) => (
              <CategoryBarRow
                key={row.cat}
                cat={row.cat}
                widthPct={(row.hours / maxHours) * 100}
                value={humanizeHours(row.hours)}
              />
            ))}
          </div>
        )
      }}
    </AnalyticsCard>
  )
}

"use client"

import { AnalyticsCard } from "@/features/analytics/analytics-card"
import { BarChart } from "@/features/analytics/analytics-charts"
import type { useAnalyticsEvents, useAnalyticsPinsByWeek } from "@/features/analytics/use-analytics"

export function PinsPerWeekCard({ query }: { query: ReturnType<typeof useAnalyticsPinsByWeek> }) {
  return (
    <AnalyticsCard
      title="Pins per week"
      meta="8-week trend"
      span2
      query={query}
      isEmpty={(data) => data.weeks.length === 0}
    >
      {(data) => <BarChart values={data.weeks} labels={data.labels} />}
    </AnalyticsCard>
  )
}

export function CleanupEventsCard({ query }: { query: ReturnType<typeof useAnalyticsEvents> }) {
  return (
    <AnalyticsCard
      title="Cleanup events"
      meta="8-month trend"
      span2
      query={query}
      isEmpty={(data) => data.byMonth.length === 0}
    >
      {(data) => (
        <>
          <div className="events-summary">
            <div className="es-stat">
              <span className="es-num">{data.thisMonth}</span>
              <span className="es-lbl">events this month</span>
            </div>
            <div className="es-stat">
              <span className="es-num">{data.volunteers.toLocaleString()}</span>
              <span className="es-lbl">volunteers</span>
            </div>
            {data.bags > 0 ? (
              <div className="es-stat">
                <span className="es-num">{data.bags.toLocaleString()}</span>
                <span className="es-lbl">bags collected</span>
              </div>
            ) : null}
          </div>
          <BarChart values={data.byMonth} labels={data.monthLabels} />
        </>
      )}
    </AnalyticsCard>
  )
}

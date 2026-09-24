"use client"

import { Icons } from "@/components/icons"
import { PageHead } from "@/components/shared/page-primitives"
import {
  ByCategoryCard,
  CoverageCard,
  FunnelCard,
  ResolutionTimeCard,
} from "@/features/analytics/analytics-breakdown-cards"
import { KpiSection, visibleKpis } from "@/features/analytics/analytics-kpis"
import { TopContributorsCard, TopJurisdictionsCard } from "@/features/analytics/analytics-rank-cards"
import { CleanupEventsCard, PinsPerWeekCard } from "@/features/analytics/analytics-trend-cards"
import {
  useAnalyticsByCategory,
  useAnalyticsCoverage,
  useAnalyticsEvents,
  useAnalyticsFunnel,
  useAnalyticsKpis,
  useAnalyticsPinsByWeek,
  useAnalyticsResolutionByCategory,
  useAnalyticsTopContributors,
  useAnalyticsTopJurisdictions,
} from "@/features/analytics/use-analytics"
import { useAnalyticsExport } from "@/features/analytics/use-analytics-export"
import type { SectionPageProps } from "@/components/shell/page-registry"

const DISABLED_EXPORT_STYLE = { opacity: 0.45, cursor: "not-allowed" } as const

export function AnalyticsPage(_props: SectionPageProps) {
  const kpisQuery = useAnalyticsKpis()
  const pinsQuery = useAnalyticsPinsByWeek()
  const byCategoryQuery = useAnalyticsByCategory()
  const funnelQuery = useAnalyticsFunnel()
  const coverageQuery = useAnalyticsCoverage()
  const resolutionQuery = useAnalyticsResolutionByCategory()
  const eventsQuery = useAnalyticsEvents()
  const topJurisdictionsQuery = useAnalyticsTopJurisdictions()
  const topContributorsQuery = useAnalyticsTopContributors()

  const shownKpis = kpisQuery.data ? visibleKpis(kpisQuery.data) : null
  const { canExport, exportCsv } = useAnalyticsExport(
    shownKpis,
    eventsQuery.data,
    byCategoryQuery.data,
  )

  return (
    <>
      <PageHead
        title="Analytics"
        subtitle={
          <span>
            The numbers are the proof civfix works. Pins dropped, reports routed, issues resolved,
            cleanups planned.
          </span>
        }
      >
        <button
          className="btn"
          onClick={exportCsv}
          disabled={!canExport}
          style={!canExport ? DISABLED_EXPORT_STYLE : undefined}
        >
          <Icons.FileText size={13} /> Export
        </button>
      </PageHead>

      <KpiSection kpisQuery={kpisQuery} shownKpis={shownKpis ?? []} />

      <div className="analytics-grid">
        <PinsPerWeekCard query={pinsQuery} />
        <ByCategoryCard query={byCategoryQuery} />
        <FunnelCard query={funnelQuery} />
        <CoverageCard query={coverageQuery} />
        <ResolutionTimeCard query={resolutionQuery} />
        <CleanupEventsCard query={eventsQuery} />
        <TopJurisdictionsCard query={topJurisdictionsQuery} />
        <TopContributorsCard query={topContributorsQuery} />
      </div>
    </>
  )
}

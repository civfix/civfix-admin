"use client"

import type { AnalyticsKpi, AnalyticsKpisResponse } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import type { useAnalyticsKpis } from "@/features/analytics/use-analytics"

// The server sends "Avg. route time" as a placeholder cell and marks percentages only through the
// label, so both are matched on the copy until the KPI contract carries a key and a unit.
const HIDDEN_KPI_LABEL = /route/i
const PERCENT_KPI_LABEL = /resolved/i

type KpiDirection = AnalyticsKpi["dir"]

const KPI_DELTA_COLOR: Record<KpiDirection, string> = {
  up: "var(--moss-700)",
  down: "var(--danger)",
  flat: "var(--ink-3)",
}

export function visibleKpis(kpis: AnalyticsKpisResponse): AnalyticsKpi[] {
  return kpis.kpis.filter((k) => !HIDDEN_KPI_LABEL.test(k.label))
}

export function isPercentKpi(kpi: AnalyticsKpi): boolean {
  return PERCENT_KPI_LABEL.test(kpi.label)
}

function KpiDelta({ delta, dir }: { delta: string; dir: KpiDirection }) {
  const Arrow = dir === "up" ? Icons.ArrowUp : dir === "down" ? Icons.ArrowDown : null
  return (
    <div className="statcell-hot" style={{ color: KPI_DELTA_COLOR[dir] }}>
      {Arrow ? <Arrow size={10} /> : null} {delta}
    </div>
  )
}

function KpiStrip({ kpis }: { kpis: AnalyticsKpi[] }) {
  return (
    <>
      {kpis.map((kpi) => (
        <div key={kpi.label} className="statcell">
          <div className="statcell-label">{kpi.label}</div>
          <div className="statcell-num">
            {isPercentKpi(kpi) ? `${Math.round(kpi.num)}%` : kpi.num.toLocaleString()}
          </div>
          <KpiDelta delta={kpi.delta} dir={kpi.dir} />
        </div>
      ))}
    </>
  )
}

export function KpiSection({
  kpisQuery,
  shownKpis,
}: {
  kpisQuery: ReturnType<typeof useAnalyticsKpis>
  shownKpis: AnalyticsKpi[]
}) {
  if (kpisQuery.isLoading) {
    return (
      <div className="strip-state">
        <LoadingState label="Loading KPIs..." />
      </div>
    )
  }
  if (kpisQuery.isError) {
    return (
      <div className="strip-state">
        <ErrorState error={kpisQuery.error} onRetry={() => kpisQuery.refetch()} />
      </div>
    )
  }
  if (shownKpis.length === 0) {
    return (
      <div className="strip-state">
        <EmptyState title="No data yet" sub="Nothing to show for this window." />
      </div>
    )
  }
  return (
    <div className="statusstrip kpi-strip">
      <KpiStrip kpis={shownKpis} />
    </div>
  )
}

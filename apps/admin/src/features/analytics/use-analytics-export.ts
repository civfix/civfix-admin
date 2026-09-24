"use client"

import {
  REPORT_CATEGORY_LABELS,
  type AnalyticsByCategoryResponse,
  type AnalyticsEventsResponse,
  type AnalyticsKpi,
} from "@civfix/shared"

import { downloadCsv } from "@/lib/csv"
import { isPercentKpi } from "@/features/analytics/analytics-kpis"
import { useToast } from "@/store/ui-store"

const EXPORT_FILENAME = "civfix-analytics.csv"

export function useAnalyticsExport(
  shownKpis: AnalyticsKpi[] | null,
  events: AnalyticsEventsResponse | undefined,
  byCategory: AnalyticsByCategoryResponse | undefined,
) {
  const toast = useToast()
  const canExport = shownKpis !== null && !!events && !!byCategory

  const exportCsv = () => {
    if (shownKpis === null || !events || !byCategory) return
    const rows: (string | number)[][] = [["Metric", "Value", "Change"]]
    shownKpis.forEach((kpi) =>
      rows.push([kpi.label, isPercentKpi(kpi) ? `${Math.round(kpi.num)}%` : kpi.num, kpi.delta]),
    )
    rows.push(["Cleanup events (month)", events.thisMonth, ""])
    rows.push(["Volunteers", events.volunteers, ""])
    rows.push([])
    rows.push(["Category", "Reports", "Share %"])
    byCategory.rows.forEach((row) => rows.push([REPORT_CATEGORY_LABELS[row.cat], row.count, row.pct]))
    downloadCsv(EXPORT_FILENAME, rows)
    toast(`Analytics exported · ${EXPORT_FILENAME}`)
  }

  return { canExport, exportCsv }
}

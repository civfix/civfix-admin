"use client"

import { SectionStub } from "@/components/shared/section-stub"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Analytics (enumeration 2.G). WAVE 2: replace with the KPI strip + analytics grid (pins/week, by
 * category, funnel, coverage, resolution, events, top jurisdictions/contributors, plus heatmap +
 * retention). Data: the analytics* hooks (analyticsKpis, analyticsByCategory, ...). Keep the named
 * export `AnalyticsPage`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AnalyticsPage(_props: SectionPageProps) {
  return (
    <SectionStub
      title="Analytics"
      subtitle="The numbers are the proof civfix works - dropped, routed, resolved, cleaned up."
    />
  )
}

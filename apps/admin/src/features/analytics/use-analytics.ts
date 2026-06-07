"use client"

import { useQuery } from "@tanstack/react-query"
import type {
  AnalyticsByCategoryResponse,
  AnalyticsCoverageResponse,
  AnalyticsEventsResponse,
  AnalyticsFunnelResponse,
  AnalyticsKpisResponse,
  AnalyticsPinsByWeekResponse,
  AnalyticsResolutionByCategoryResponse,
  AnalyticsTopContributorsResponse,
  AnalyticsTopJurisdictionsResponse,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

/**
 * Data hooks for the Analytics section (enumeration 2.G). Each analytics card is an INDEPENDENT read so
 * one failing aggregate does not blank the whole page (each card renders its own loading / error /
 * empty state). All nine endpoints take no arguments (the server scopes the window). These are reads
 * only; analytics has no mutations (the CSV Export is a client-side download in the page).
 *
 * Query keys: reuses the existing registry (analytics.kpis/pinsByWeek/.../retention). No local keys
 * were needed.
 */

/** GET /admin/analytics/kpis - the KPI strip cells. */
export function useAnalyticsKpis() {
  return useQuery<AnalyticsKpisResponse>({
    queryKey: queryKeys.analytics.kpis,
    queryFn: () => api.analyticsKpis(),
  })
}

/** GET /admin/analytics/pins-by-week - the 8-week pins trend. */
export function useAnalyticsPinsByWeek() {
  return useQuery<AnalyticsPinsByWeekResponse>({
    queryKey: queryKeys.analytics.pinsByWeek,
    queryFn: () => api.analyticsPinsByWeek(),
  })
}

/** GET /admin/analytics/by-category - per-category report counts + share. */
export function useAnalyticsByCategory() {
  return useQuery<AnalyticsByCategoryResponse>({
    queryKey: queryKeys.analytics.byCategory,
    queryFn: () => api.analyticsByCategory(),
  })
}

/** GET /admin/analytics/funnel - pin -> routed -> acknowledged -> resolved. */
export function useAnalyticsFunnel() {
  return useQuery<AnalyticsFunnelResponse>({
    queryKey: queryKeys.analytics.funnel,
    queryFn: () => api.analyticsFunnel(),
  })
}

/** GET /admin/analytics/coverage - mapped vs needs-mapping jurisdictions. */
export function useAnalyticsCoverage() {
  return useQuery<AnalyticsCoverageResponse>({
    queryKey: queryKeys.analytics.coverage,
    queryFn: () => api.analyticsCoverage(),
  })
}

/** GET /admin/analytics/resolution-by-category - median resolution hours per category. */
export function useAnalyticsResolutionByCategory() {
  return useQuery<AnalyticsResolutionByCategoryResponse>({
    queryKey: queryKeys.analytics.resolutionByCategory,
    queryFn: () => api.analyticsResolutionByCategory(),
  })
}

/** GET /admin/analytics/events - cleanup events stats + 8-month trend. */
export function useAnalyticsEvents() {
  return useQuery<AnalyticsEventsResponse>({
    queryKey: queryKeys.analytics.events,
    queryFn: () => api.analyticsEvents(),
  })
}

/** GET /admin/analytics/top-jurisdictions - top jurisdictions by pin volume. */
export function useAnalyticsTopJurisdictions() {
  return useQuery<AnalyticsTopJurisdictionsResponse>({
    queryKey: queryKeys.analytics.topJurisdictions,
    queryFn: () => api.analyticsTopJurisdictions(),
  })
}

/** GET /admin/analytics/top-contributors - top contributors by reports + cleanups. */
export function useAnalyticsTopContributors() {
  return useQuery<AnalyticsTopContributorsResponse>({
    queryKey: queryKeys.analytics.topContributors,
    queryFn: () => api.analyticsTopContributors(),
  })
}

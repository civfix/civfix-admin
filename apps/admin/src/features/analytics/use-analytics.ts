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

// Each card is its own query so one failing aggregate does not blank the whole page.

export function useAnalyticsKpis() {
  return useQuery<AnalyticsKpisResponse>({
    queryKey: queryKeys.analytics.kpis,
    queryFn: () => api.analyticsKpis(),
  })
}

export function useAnalyticsPinsByWeek() {
  return useQuery<AnalyticsPinsByWeekResponse>({
    queryKey: queryKeys.analytics.pinsByWeek,
    queryFn: () => api.analyticsPinsByWeek(),
  })
}

export function useAnalyticsByCategory() {
  return useQuery<AnalyticsByCategoryResponse>({
    queryKey: queryKeys.analytics.byCategory,
    queryFn: () => api.analyticsByCategory(),
  })
}

export function useAnalyticsFunnel() {
  return useQuery<AnalyticsFunnelResponse>({
    queryKey: queryKeys.analytics.funnel,
    queryFn: () => api.analyticsFunnel(),
  })
}

export function useAnalyticsCoverage() {
  return useQuery<AnalyticsCoverageResponse>({
    queryKey: queryKeys.analytics.coverage,
    queryFn: () => api.analyticsCoverage(),
  })
}

export function useAnalyticsResolutionByCategory() {
  return useQuery<AnalyticsResolutionByCategoryResponse>({
    queryKey: queryKeys.analytics.resolutionByCategory,
    queryFn: () => api.analyticsResolutionByCategory(),
  })
}

export function useAnalyticsEvents() {
  return useQuery<AnalyticsEventsResponse>({
    queryKey: queryKeys.analytics.events,
    queryFn: () => api.analyticsEvents(),
  })
}

export function useAnalyticsTopJurisdictions() {
  return useQuery<AnalyticsTopJurisdictionsResponse>({
    queryKey: queryKeys.analytics.topJurisdictions,
    queryFn: () => api.analyticsTopJurisdictions(),
  })
}

export function useAnalyticsTopContributors() {
  return useQuery<AnalyticsTopContributorsResponse>({
    queryKey: queryKeys.analytics.topContributors,
    queryFn: () => api.analyticsTopContributors(),
  })
}

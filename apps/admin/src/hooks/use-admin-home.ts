"use client"

import { useQuery } from "@tanstack/react-query"
import type {
  HomeSummaryResponse,
  HomeMapResponse,
  ActivityListResponse,
  SystemHealthResponse,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

/**
 * Data hooks for the home/dashboard hub. Each is a plain React Query read; the home page renders the
 * loading / error / empty states from these. They are independent so a card can fail without taking
 * down the rest of the dashboard (enumeration 2.A.6: partial-failure tolerant home).
 */

/** GET /admin/home/summary - the per-section counts/leads the hub shows. */
export function useHomeSummary() {
  return useQuery<HomeSummaryResponse>({
    queryKey: queryKeys.home.summary,
    queryFn: () => api.adminHomeSummary(),
  })
}

/** GET /admin/home/map - the live-map feed (recent reports + events with coords/status/flag). */
export function useHomeMap() {
  return useQuery<HomeMapResponse>({
    queryKey: queryKeys.home.map,
    queryFn: () => api.adminHomeMap(),
  })
}

/** GET /admin/activity - the recent activity / audit feed. */
export function useActivity() {
  return useQuery<ActivityListResponse>({
    queryKey: queryKeys.activity.list(),
    // The activity list query has only optional fields (q/filter/sort/cursor/limit); pass an empty
    // object to satisfy the typed client signature.
    queryFn: () => api.adminActivity({}),
  })
}

/** GET /admin/system/health - service health summary. */
export function useSystemHealth() {
  return useQuery<SystemHealthResponse>({
    queryKey: queryKeys.system.health,
    queryFn: () => api.adminSystemHealth(),
  })
}

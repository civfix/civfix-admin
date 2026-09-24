"use client"

import { useQuery } from "@tanstack/react-query"
import type { HomeSummaryResponse, HomeMapResponse } from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

// Separate queries so one home card can fail without taking down the rest of the dashboard.

export function useHomeSummary() {
  return useQuery<HomeSummaryResponse>({
    queryKey: queryKeys.home.summary,
    queryFn: () => api.adminHomeSummary(),
  })
}

export function useHomeMap() {
  return useQuery<HomeMapResponse>({
    queryKey: queryKeys.home.map,
    queryFn: () => api.adminHomeMap(),
  })
}

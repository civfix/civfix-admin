"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminDevEnvironment,
  AdminDevJobsResponse,
  AdminDevOverviewResponse,
  SystemHealthResponse,
} from "@civfix/contract"

import { api } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { invalidateKeys, queryKeys } from "@/lib/query"
import { SECOND_MS } from "@/lib/timing"
import { useDevToast } from "@/features/dev/dev-toast"

const JOBS_REFRESH_MS = 30 * SECOND_MS

export function useDevOverview() {
  return useQuery<AdminDevOverviewResponse>({
    queryKey: queryKeys.dev.overview,
    queryFn: () => api.adminDevOverview(),
  })
}

/** Null until the overview answers; "unknown" when it can't, so nothing reads as safer than it is. */
export function useDevEnvironment(): AdminDevEnvironment | null {
  const { data, isError } = useDevOverview()
  if (data) return data.environment
  return isError ? "unknown" : null
}

export function useDevSystemHealth() {
  return useQuery<SystemHealthResponse>({
    queryKey: queryKeys.dev.systemHealth,
    queryFn: () => api.adminSystemHealth(),
  })
}

/** Refreshes only while a component using it is mounted, which is while the Jobs tab is open. */
export function useDevJobs() {
  return useQuery<AdminDevJobsResponse>({
    queryKey: queryKeys.dev.jobs,
    queryFn: () => api.adminDevJobs(),
    refetchInterval: JOBS_REFRESH_MS,
  })
}

export function useRunDevJob() {
  const qc = useQueryClient()
  const toast = useDevToast()
  return useMutation({
    mutationFn: (name: string) => api.adminDevRunJob({ name }),
    // The shell's toast, where the global handler sends errors, is not on this page.
    meta: { errorToast: false },
    onSuccess: ({ enqueued }) => {
      toast(enqueued ? "Run queued" : "A run is already waiting", "ok")
      return invalidateKeys(qc, [queryKeys.dev.jobs])
    },
    onError: (error) => toast(errorMessage(error), "error"),
  })
}

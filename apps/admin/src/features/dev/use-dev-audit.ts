"use client"

import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type { ActivityListResponse, AuditListQuery } from "@civfix/contract"

import { api } from "@/lib/api"
import { infiniteListOptions } from "@/lib/infinite"
import { queryKeys } from "@/lib/query"

// The admin API pages 25 by default.
const PAGE_SIZE = 50

export interface AuditFilters {
  action: string
  actor: string
}

/** A blank filter is left out of the request, so it reads the same cache entry as no filter at all. */
export function auditListParams({ action, actor }: AuditFilters): AuditListQuery {
  const actionTerm = action.trim()
  const actorTerm = actor.trim()
  return {
    limit: PAGE_SIZE,
    ...(actionTerm ? { action: actionTerm } : {}),
    ...(actorTerm ? { actor: actorTerm } : {}),
  }
}

/** The filters are part of the key, so a new filter starts again from the first page. */
export function useDevAuditLog(params: AuditListQuery) {
  return useInfiniteQuery(
    infiniteListOptions(queryKeys.audit.list(params), params, (input) => api.listAudit(input)),
  )
}

/** The newest page only: the tab shows recent activity, not its history. */
export function useDevActivity() {
  return useQuery<ActivityListResponse>({
    queryKey: queryKeys.dev.activity,
    queryFn: () => api.adminActivity({ limit: PAGE_SIZE }),
  })
}

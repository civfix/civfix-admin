"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminReportListQuery,
  AdminReportListResponse,
  FlagReportRequest,
  GetAdminReportResponse,
  RemoveReportRequest,
  SendFollowupRequest,
  SetReportStatusRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

/**
 * Data hooks for the Reports section (enumeration 2.C). Reads use GET /admin/reports (list) and GET
 * /admin/reports/:id (detail); writes use set-status / flag / remove / send-followup. Every mutation
 * invalidates the reports caches plus the cross-cutting home + activity feeds (a status/flag/remove
 * changes the dashboard aggregates and the activity feed), per the scaffold's documented pattern.
 *
 * Query keys: reuses the existing registry (reports.list/detail/all). No local keys were needed.
 */

/** GET /admin/reports - the report list (filter by civfix status + flagged + search via params). */
export function useReportList(params: AdminReportListQuery) {
  return useQuery<AdminReportListResponse>({
    queryKey: queryKeys.reports.list(params),
    queryFn: () => api.listAdminReports(params),
  })
}

/** GET /admin/reports/:id - full report (desc, timeline, reporter, routing, media). */
export function useReport(id: string | null) {
  return useQuery<GetAdminReportResponse>({
    queryKey: queryKeys.reports.detail(id ?? ""),
    queryFn: () => api.getAdminReport({ id: id as string }),
    enabled: !!id,
  })
}

/** Invalidate every report view plus the home + activity aggregates after a write. */
function invalidateReports(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: queryKeys.reports.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.reports.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
  qc.invalidateQueries({ queryKey: queryKeys.activity.all })
}

/** POST /admin/reports/:id/status - quick status change (writes the report timeline). */
export function useSetReportStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetReportStatusRequest) => api.setReportStatus(input),
    onSuccess: (_res, { id }) => invalidateReports(qc, id),
  })
}

/** POST /admin/reports/:id/flag - flag / unflag a report. */
export function useFlagReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FlagReportRequest) => api.flagReport(input),
    onSuccess: (_res, { id }) => invalidateReports(qc, id),
  })
}

/** POST /admin/reports/:id/remove - remove a report (-> rejected). */
export function useRemoveReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RemoveReportRequest) => api.removeReport(input),
    onSuccess: (_res, { id }) => invalidateReports(qc, id),
  })
}

/** POST /admin/reports/:id/message - send a follow-up to the reporter or the routed city contact. */
export function useSendReportFollowup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SendFollowupRequest) => api.sendReportFollowup(input),
    onSuccess: (_res, { id }) => invalidateReports(qc, id),
  })
}

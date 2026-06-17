"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminReportListQuery,
  AdminReportListResponse,
  DiscussionPageResponse,
  FlagReportRequest,
  GetAdminReportDiscussionRequest,
  GetAdminReportResponse,
  RemoveDiscussionMessageRequest,
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

/**
 * GET /admin/reports/:id/discussion - the operator view of a report's PUBLIC discussion (the threaded
 * comment surface, separate from the status timeline). Unlike the citizen read this page INCLUDES
 * soft-removed/tombstoned messages so operators can see what was taken down. Paginated keyset (the
 * response carries `nextCursor`); the cursor is part of the query key so paging back never collides with
 * the first page. Scoped to the report id and only fetched once an id is selected.
 */
export function useReportDiscussion(id: string | null, cursor?: string) {
  const params: Omit<GetAdminReportDiscussionRequest, "id"> = cursor ? { cursor } : {}
  return useQuery<DiscussionPageResponse>({
    queryKey: queryKeys.reports.discussion(id ?? "", params),
    queryFn: () => api.getAdminReportDiscussion({ id: id as string, ...params }),
    enabled: !!id,
  })
}

/**
 * POST /admin/reports/:id/discussion/:messageId/remove - operator soft-delete of a single discussion
 * message (audited; optional reason). On success we invalidate THIS report's discussion pages (so the
 * removed message re-renders as a tombstone), plus the cross-cutting activity feed (a removal is an
 * operator action). The report detail/list aggregates are untouched - a discussion removal does not
 * change a report's status, flag, or counts.
 */
export function useRemoveDiscussionMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RemoveDiscussionMessageRequest) => api.removeDiscussionMessage(input),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.reports.discussion(id) })
      qc.invalidateQueries({ queryKey: queryKeys.activity.all })
    },
  })
}

"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminReportListQuery,
  AdminReportListResponse,
  ChatHistoryResponse,
  DeleteReportMessageRequest,
  FlagReportRequest,
  GetAdminReportResponse,
  RemoveReportRequest,
  RouteReportRequest,
  SendFollowupRequest,
  SetReportStatusRequest,
  SetReportVerdictRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"


export function useReportList(params: AdminReportListQuery) {
  return useQuery<AdminReportListResponse>({
    queryKey: queryKeys.reports.page(params),
    queryFn: () => api.listAdminReports(params),
  })
}

export function useReportListInfinite(params: AdminReportListQuery) {
  return useInfiniteQuery<AdminReportListResponse>({
    queryKey: queryKeys.reports.list(params),
    queryFn: ({ pageParam }) =>
      api.listAdminReports({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useReport(id: string | null) {
  return useQuery<GetAdminReportResponse>({
    queryKey: queryKeys.reports.detail(id ?? ""),
    queryFn: () => api.getAdminReport({ id: id as string }),
    enabled: !!id,
  })
}

function invalidateReports(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: queryKeys.reports.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.reports.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
}

export function useSetReportStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetReportStatusRequest) => api.setReportStatus(input),
    onSuccess: (_res, { id }) => invalidateReports(qc, id),
  })
}

export function useFlagReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FlagReportRequest) => api.flagReport(input),
    onSuccess: (_res, { id }) => invalidateReports(qc, id),
  })
}

export function useRemoveReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RemoveReportRequest) => api.removeReport(input),
    onSuccess: (_res, { id }) => invalidateReports(qc, id),
  })
}

export function useSendReportFollowup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SendFollowupRequest) => api.sendReportFollowup(input),
    onSuccess: (_res, { id }) => invalidateReports(qc, id),
  })
}

export function useRouteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RouteReportRequest) => api.routeReport(input),
    onSuccess: (_res, { id }) => {
      invalidateReports(qc, id)
      qc.invalidateQueries({ queryKey: queryKeys.mail.all })
      qc.invalidateQueries({ queryKey: queryKeys.discovery.all })
      qc.invalidateQueries({ queryKey: queryKeys.jurisdictions.all })
    },
  })
}

export function useSetReportVerdict() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetReportVerdictRequest) => api.setReportVerdict(input),
    onSuccess: (_res, { id }) => {
      invalidateReports(qc, id)
      qc.invalidateQueries({ queryKey: queryKeys.users.all })
    },
  })
}

/**
 * Read-only report CHAT history for the admin report detail. This hits the SAME endpoint the citizen
 * client uses (`reportMessages` → GET /reports/:id/messages), so operators see exactly what neighbors
 * see, including sender-less SYSTEM status events. Admins observe + moderate here — there is no composer.
 *
 * Pagination is intentionally minimal: we fetch the first page (newest window, up to `limit`) which is
 * plenty for an admin glance. `nextCursor` (older messages via `before`) is ignored on purpose.
 */
const REPORT_CHAT_LIMIT = 50

export function useReportChatHistory(id: string | null) {
  return useQuery<ChatHistoryResponse>({
    queryKey: queryKeys.reports.chat(id ?? ""),
    queryFn: () => api.reportMessages({ id: id as string, limit: REPORT_CHAT_LIMIT }),
    enabled: !!id,
  })
}

export function useDeleteReportMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: DeleteReportMessageRequest) => api.deleteReportMessage(input),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.reports.chat(id) })
    },
  })
}

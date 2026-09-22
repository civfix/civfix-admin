"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminRemoveReportMessageRequest,
  AdminReportListQuery,
  AdminReportListResponse,
  AdminSendReportMessageRequest,
  ChatHistoryResponse,
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
 * The report CHAT history on the ADMIN plane (GET /admin/reports/:id/messages), so it resolves against
 * admin.civfix.org like every other operator read. Operators see exactly what neighbors see, including
 * sender-less SYSTEM status events, and can post into the same thread.
 *
 * Pagination is intentionally minimal: we fetch the first page (newest window, up to `limit`) which is
 * plenty for an admin glance. `nextCursor` (older messages via `before`) is ignored on purpose.
 */
const REPORT_CHAT_LIMIT = 50

export function useReportChatHistory(id: string | null) {
  return useQuery<ChatHistoryResponse>({
    queryKey: queryKeys.reports.chat(id ?? ""),
    queryFn: () => api.adminReportMessages({ id: id as string, limit: REPORT_CHAT_LIMIT }),
    enabled: !!id,
  })
}

export function useSendReportMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminSendReportMessageRequest) => api.adminSendReportMessage(input),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.reports.chat(id) })
      qc.invalidateQueries({ queryKey: queryKeys.reports.detail(id) })
    },
  })
}

export function useRemoveReportMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminRemoveReportMessageRequest) => api.adminRemoveReportMessage(input),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.reports.chat(id) })
    },
  })
}

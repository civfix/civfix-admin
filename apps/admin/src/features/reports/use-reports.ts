"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminReportListQuery,
  AdminReportListResponse,
  DiscussionPageResponse,
  FlagReportRequest,
  GetAdminReportDiscussionRequest,
  GetAdminReportResponse,
  RemoveDiscussionMessageRequest,
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
    queryKey: queryKeys.reports.list(params),
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
  qc.invalidateQueries({ queryKey: queryKeys.activity.all })
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
    onSuccess: (_res, { id }) => invalidateReports(qc, id),
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

export function useReportDiscussion(id: string | null, cursor?: string) {
  const params: Omit<GetAdminReportDiscussionRequest, "id"> = cursor ? { cursor } : {}
  return useQuery<DiscussionPageResponse>({
    queryKey: queryKeys.reports.discussion(id ?? "", params),
    queryFn: () => api.getAdminReportDiscussion({ id: id as string, ...params }),
    enabled: !!id,
  })
}

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

"use client"

import {
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  ADMIN_REPORT_STATUS_LABELS,
  type AdminRemoveReportMessageRequest,
  type AdminReportListQuery,
  type AdminReportListResponse,
  type AdminSendReportMessageRequest,
  type ChatHistoryResponse,
  type FlagReportRequest,
  type GetAdminReportResponse,
  type RemoveReportRequest,
  type RouteReportRequest,
  type SendFollowupRequest,
  type SetReportStatusRequest,
  type SetReportVerdictRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { useUiStore } from "@/store/ui-store"
import { shortId } from "@/features/reports/report-id"

export function useReportList(params: AdminReportListQuery) {
  return useQuery<AdminReportListResponse>({
    queryKey: queryKeys.reports.page(params),
    queryFn: () => api.listAdminReports(params),
  })
}

export function useReportListInfinite(
  params: AdminReportListQuery,
  opts: { keepPreviousData?: boolean } = {},
) {
  return useInfiniteQuery<AdminReportListResponse>({
    queryKey: queryKeys.reports.list(params),
    queryFn: ({ pageParam }) =>
      api.listAdminReports({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    ...(opts.keepPreviousData ? { placeholderData: keepPreviousData } : {}),
  })
}

function reportQuery(id: string) {
  return queryOptions<GetAdminReportResponse>({
    queryKey: queryKeys.reports.detail(id),
    queryFn: () => api.getAdminReport({ id }),
  })
}

export function useReport(id: string | null) {
  return useQuery({ ...reportQuery(id ?? ""), enabled: !!id })
}

export function useRefreshReportMedia(id: string): () => void {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.reports.detail(id) })
  }
}

// Profiles, event detail and the moderation queue all render a report's status and flag.
function invalidateReports(qc: ReturnType<typeof useQueryClient>, id: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.reports.detail(id) }),
    qc.invalidateQueries({ queryKey: queryKeys.reports.all }),
    qc.invalidateQueries({ queryKey: queryKeys.home.all }),
    qc.invalidateQueries({ queryKey: queryKeys.users.all }),
    qc.invalidateQueries({ queryKey: queryKeys.events.all }),
    qc.invalidateQueries({ queryKey: queryKeys.moderation.all }),
  ])
}

export function useSetReportStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetReportStatusRequest) => api.setReportStatus(input),
    onSuccess: (_res, { id }) => invalidateReports(qc, id),
    meta: {
      successMessage: (_res: unknown, { id, status }: SetReportStatusRequest) =>
        `${shortId(id)} · status → ${ADMIN_REPORT_STATUS_LABELS[status]}`,
    },
  })
}

export function useFlagReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FlagReportRequest) => api.flagReport(input),
    // The endpoint toggles, so another operator's flag since this load flips the outcome: word the
    // toast from the report as it now is.
    onSuccess: async (_res, { id }) => {
      await invalidateReports(qc, id)
      let report: GetAdminReportResponse
      try {
        report = await qc.fetchQuery(reportQuery(id))
      } catch {
        // The flag already changed and the refetch failed: skip the toast rather than guess its wording.
        return
      }
      useUiStore
        .getState()
        .showToast(report.flagged ? `${shortId(id)} · flagged for review` : `${shortId(id)} · flag cleared`)
    },
  })
}

export function useRemoveReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RemoveReportRequest) => api.removeReport(input),
    onSuccess: (_res, { id }) => invalidateReports(qc, id),
    meta: {
      successMessage: (_res: unknown, { id }: RemoveReportRequest) => `${shortId(id)} · report removed`,
    },
  })
}

export function useSendReportFollowup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SendFollowupRequest) => api.sendReportFollowup(input),
    onSuccess: (_res, { id }) => invalidateReports(qc, id),
    meta: { successMessage: () => "Follow-up sent to city" },
  })
}

export function useRouteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RouteReportRequest) => api.routeReport(input),
    onSuccess: (_res, { id }) =>
      Promise.all([
        invalidateReports(qc, id),
        qc.invalidateQueries({ queryKey: queryKeys.mail.all }),
        qc.invalidateQueries({ queryKey: queryKeys.discovery.all }),
        qc.invalidateQueries({ queryKey: queryKeys.jurisdictions.all }),
      ]),
  })
}

const VERDICT_TOAST: Record<SetReportVerdictRequest["verdict"], string> = {
  approved: "approved",
  rejected: "rejected",
}

export function useSetReportVerdict() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetReportVerdictRequest) => api.setReportVerdict(input),
    onSuccess: (_res, { id }) => invalidateReports(qc, id),
    meta: {
      successMessage: (_res: unknown, { id, verdict }: SetReportVerdictRequest) =>
        `${shortId(id)} · ${VERDICT_TOAST[verdict]}`,
    },
  })
}

/**
 * The report CHAT history on the ADMIN plane (GET /admin/reports/:id/messages), so it resolves against
 * admin.civfix.org like every other operator read. Operators see exactly what neighbors see, including
 * sender-less SYSTEM status events, and can post into the same thread. Pages run newest first; each
 * `nextCursor` asks for the window before it, so older messages stay reachable for moderation.
 */
const REPORT_CHAT_LIMIT = 50

export function useReportChatHistory(id: string | null) {
  return useInfiniteQuery<ChatHistoryResponse>({
    queryKey: queryKeys.reports.chat(id ?? ""),
    queryFn: ({ pageParam }) =>
      api.adminReportMessages({
        id: id as string,
        limit: REPORT_CHAT_LIMIT,
        ...(typeof pageParam === "string" ? { before: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!id,
  })
}

export function useSendReportMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminSendReportMessageRequest) => api.adminSendReportMessage(input),
    onSuccess: (_res, { id }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.reports.chat(id) }),
        qc.invalidateQueries({ queryKey: queryKeys.reports.detail(id) }),
      ]),
    meta: { successMessage: () => "Message posted to the report chat" },
  })
}

export function useRemoveReportMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminRemoveReportMessageRequest) => api.adminRemoveReportMessage(input),
    onSuccess: (_res, { id }) => qc.invalidateQueries({ queryKey: queryKeys.reports.chat(id) }),
    meta: { successMessage: () => "Message removed" },
  })
}

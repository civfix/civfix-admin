"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminEventListQuery,
  AdminEventListResponse,
  CancelRequest,
  FlagEventRequest,
  GetAdminEventResponse,
  LinkEventReportsRequest,
  PostMessageRequest,
  SetEventOutcomeRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"


export function useEventList(params: AdminEventListQuery) {
  return useQuery<AdminEventListResponse>({
    queryKey: queryKeys.events.list(params),
    queryFn: () => api.listAdminEvents(params),
  })
}

export function useEventListInfinite(params: AdminEventListQuery) {
  return useInfiniteQuery<AdminEventListResponse>({
    queryKey: queryKeys.events.list(params),
    queryFn: ({ pageParam }) =>
      api.listAdminEvents({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useEvent(id: string | null) {
  return useQuery<GetAdminEventResponse>({
    queryKey: queryKeys.events.detail(id ?? ""),
    queryFn: () => api.getAdminEvent({ id: id as string }),
    enabled: !!id,
  })
}

function invalidateEvents(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: queryKeys.events.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.events.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
}

export function useFlagEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FlagEventRequest) => api.flagEvent(input),
    onSuccess: (_res, { id }) => invalidateEvents(qc, id),
  })
}

export function useCancelEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CancelRequest) => api.cancelEvent(input),
    onSuccess: (_res, { id }) => invalidateEvents(qc, id),
  })
}

export function usePostEventMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PostMessageRequest) => api.postEventMessage(input),
    onSuccess: (_res, { id }) => invalidateEvents(qc, id),
  })
}

export function useSetEventOutcome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetEventOutcomeRequest) => api.setEventOutcome(input),
    onSuccess: (_res, { id }) => invalidateEvents(qc, id),
  })
}

export function useLinkReports() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LinkEventReportsRequest) => api.linkEventReports(input),
    onSuccess: (_res, { id }) => {
      invalidateEvents(qc, id)
      qc.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
  })
}

export function useUnlinkReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; reportId: string }) => api.unlinkEventReport(input),
    onSuccess: (_res, { id, reportId }) => {
      invalidateEvents(qc, id)
      qc.invalidateQueries({ queryKey: queryKeys.reports.detail(reportId) })
      qc.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
  })
}

"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminEventPageListQuery,
  AdminEventPageListResponse,
  AdminGetEventPageResponse,
  FlagEventPageRequest,
  UnpublishEventPageRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

export function useEventPagesInfinite(params: AdminEventPageListQuery) {
  return useInfiniteQuery<AdminEventPageListResponse>({
    queryKey: queryKeys.pages.list(params),
    queryFn: ({ pageParam }) =>
      api.adminListEventPages({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useAdminEventPage(cleanupId: string | null) {
  return useQuery<AdminGetEventPageResponse>({
    queryKey: queryKeys.pages.preview(cleanupId ?? ""),
    queryFn: () => api.adminGetEventPage({ id: cleanupId as string }),
    enabled: !!cleanupId,
  })
}

function invalidatePages(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.pages.all })
  qc.invalidateQueries({ queryKey: queryKeys.events.all })
  qc.invalidateQueries({ queryKey: queryKeys.audit.all })
}

export function useFlagEventPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FlagEventPageRequest) => api.adminFlagEventPage(input),
    onSuccess: (_res, { id }) => {
      invalidatePages(qc)
      qc.invalidateQueries({ queryKey: queryKeys.events.detail(id) })
    },
  })
}

export function useUnpublishEventPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UnpublishEventPageRequest) => api.adminUnpublishEventPage(input),
    onSuccess: (_res, { id }) => {
      invalidatePages(qc)
      qc.invalidateQueries({ queryKey: queryKeys.events.detail(id) })
    },
  })
}

"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  ApproveModerationRequest,
  AppealModerationRequest,
  GetModerationItemResponse,
  HoldModerationRequest,
  ModerationListQuery,
  ModerationListResponse,
  RemoveModerationRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"


export function useModerationList(params: ModerationListQuery) {
  return useQuery<ModerationListResponse>({
    queryKey: queryKeys.moderation.list(params),
    queryFn: () => api.listModeration(params),
  })
}

export function useModerationListInfinite(params: ModerationListQuery) {
  return useInfiniteQuery<ModerationListResponse>({
    queryKey: queryKeys.moderation.list(params),
    queryFn: ({ pageParam }) =>
      api.listModeration({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useModerationItem(id: string | null) {
  return useQuery<GetModerationItemResponse>({
    queryKey: queryKeys.moderation.detail(id ?? ""),
    queryFn: () => api.getModerationItem({ id: id as string }),
    enabled: !!id,
  })
}

function invalidateModeration(qc: ReturnType<typeof useQueryClient>, id?: string) {
  if (id) qc.invalidateQueries({ queryKey: queryKeys.moderation.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.moderation.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
}

export function useApproveModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ApproveModerationRequest) => api.approveModeration(input),
    onSuccess: (_res, { id }) => invalidateModeration(qc, id),
  })
}

export function useRemoveModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RemoveModerationRequest) => api.removeModeration(input),
    onSuccess: (_res, { id }) => invalidateModeration(qc, id),
  })
}

export function useHoldModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: HoldModerationRequest) => api.holdModeration(input),
    onSuccess: (_res, { id }) => invalidateModeration(qc, id),
  })
}

export function useAppealModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AppealModerationRequest) => api.appealModeration(input),
    onSuccess: (_res, { id }) => invalidateModeration(qc, id),
  })
}

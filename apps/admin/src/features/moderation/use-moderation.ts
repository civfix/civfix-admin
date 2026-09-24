"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  ApproveModerationRequest,
  AppealModerationRequest,
  GetModerationItemResponse,
  HoldModerationRequest,
  ModerationItemDTO,
  ModerationListQuery,
  ModerationListResponse,
  RemoveModerationRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

export function useModerationList(params: ModerationListQuery) {
  return useQuery<ModerationListResponse>({
    queryKey: queryKeys.moderation.page(params),
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

// A decision can take down a report, a chat message, media or a whole cleanup (and its signup page) and
// changes the subject's strikes and status, so every section that shows those refreshes too.
function invalidateModeration(qc: ReturnType<typeof useQueryClient>, id?: string) {
  return Promise.all([
    id ? qc.invalidateQueries({ queryKey: queryKeys.moderation.detail(id) }) : null,
    qc.invalidateQueries({ queryKey: queryKeys.moderation.all }),
    qc.invalidateQueries({ queryKey: queryKeys.reports.all }),
    qc.invalidateQueries({ queryKey: queryKeys.events.all }),
    qc.invalidateQueries({ queryKey: queryKeys.pages.all }),
    qc.invalidateQueries({ queryKey: queryKeys.users.all }),
    qc.invalidateQueries({ queryKey: queryKeys.home.all }),
  ])
}

/** The item as the operator saw it, which the confirmation names. */
export interface ModerationDecision<Request> {
  request: Request
  item: Pick<ModerationItemDTO, "flag" | "kind">
}

export function useApproveModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ request }: ModerationDecision<ApproveModerationRequest>) =>
      api.approveModeration(request),
    onSuccess: (_res, { request: { id } }) => invalidateModeration(qc, id),
    meta: {
      successMessage: (_res: unknown, { item }: ModerationDecision<ApproveModerationRequest>) =>
        `${item.flag} · ${item.kind === "user_report" ? "kept" : "approved"}`,
    },
  })
}

export function useRemoveModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ request }: ModerationDecision<RemoveModerationRequest>) =>
      api.removeModeration(request),
    onSuccess: (_res, { request: { id } }) => invalidateModeration(qc, id),
    meta: {
      successMessage: (_res: unknown, { item }: ModerationDecision<RemoveModerationRequest>) =>
        `${item.flag} · removed`,
    },
  })
}

export function useHoldModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ request }: ModerationDecision<HoldModerationRequest>) =>
      api.holdModeration(request),
    onSuccess: (_res, { request: { id } }) => invalidateModeration(qc, id),
    meta: {
      successMessage: (_res: unknown, { item }: ModerationDecision<HoldModerationRequest>) =>
        `${item.flag} · held for review`,
    },
  })
}

export function useAppealModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ request }: ModerationDecision<AppealModerationRequest>) =>
      api.appealModeration(request),
    onSuccess: (_res, { request: { id } }) => invalidateModeration(qc, id),
    meta: {
      successMessage: (_res: unknown, { request, item }: ModerationDecision<AppealModerationRequest>) =>
        `${item.flag} · appeal ${request.decision === "uphold" ? "upheld" : "overturned"}`,
    },
  })
}

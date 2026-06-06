"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AppealModerationRequest,
  ApproveModerationRequest,
  GetModerationItemResponse,
  HoldModerationRequest,
  ModerationListQuery,
  ModerationListResponse,
  RemoveModerationRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

/**
 * Data hooks for the Moderation section (enumeration 2.I). Reads use GET /admin/moderation (queue) and
 * GET /admin/moderation/:id (detail: signals, user context, similar items, media). Writes use approve /
 * remove / hold / appeal; held items clear from the queue on action. Every mutation invalidates the
 * moderation caches plus the cross-cutting home + activity feeds, per the scaffold's documented pattern.
 *
 * Query keys: reuses the existing registry (moderation.list/detail/all). No local keys were needed.
 */

/** GET /admin/moderation - the moderation queue (filter by kind/priority + search via params). */
export function useModerationList(params: ModerationListQuery) {
  return useQuery<ModerationListResponse>({
    queryKey: queryKeys.moderation.list(params),
    queryFn: () => api.listModeration(params),
  })
}

/** GET /admin/moderation/:id - full item (desc, autoAction, signals, user, similar, media). */
export function useModerationItem(id: string | null) {
  return useQuery<GetModerationItemResponse>({
    queryKey: queryKeys.moderation.detail(id ?? ""),
    queryFn: () => api.getModerationItem({ id: id as string }),
    enabled: !!id,
  })
}

/** Invalidate every moderation view plus the home + activity aggregates after a write. */
function invalidateModeration(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: queryKeys.moderation.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.moderation.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
  qc.invalidateQueries({ queryKey: queryKeys.activity.all })
}

/** POST /admin/moderation/:id/approve - publish a held item. */
export function useApproveModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ApproveModerationRequest) => api.approveModeration(input),
    onSuccess: (_res, { id }) => invalidateModeration(qc, id),
  })
}

/** POST /admin/moderation/:id/remove - remove / reject a held item. */
export function useRemoveModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RemoveModerationRequest) => api.removeModeration(input),
    onSuccess: (_res, { id }) => invalidateModeration(qc, id),
  })
}

/** POST /admin/moderation/:id/hold - extend the hold on an item. */
export function useHoldModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: HoldModerationRequest) => api.holdModeration(input),
    onSuccess: (_res, { id }) => invalidateModeration(qc, id),
  })
}

/** POST /admin/moderation/:id/appeal - decide an appeal (uphold | overturn). */
export function useAppealModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AppealModerationRequest) => api.appealModeration(input),
    onSuccess: (_res, { id }) => invalidateModeration(qc, id),
  })
}

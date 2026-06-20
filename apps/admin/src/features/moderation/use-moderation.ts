"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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

/**
 * Data hooks for the Moderation section — the unified moderation queue (held media / coordinated
 * clusters / appeals PLUS citizen-filed UGC content reports, `kind === "user_report"`, that come from
 * the user-facing "Report" button). Reads: GET /admin/moderation (list), GET /admin/moderation/:id
 * (detail). Writes: approve / remove / hold / appeal. Every mutation invalidates the moderation caches
 * plus the cross-cutting home + activity feeds (an action clears the item from the queue and emits a
 * `mod_action` activity row), mirroring the scaffold's documented pattern (see use-reports.ts).
 *
 * Query keys: the registry's `moderation` block (list/detail/all). No local keys were needed.
 */

/** GET /admin/moderation — the moderation queue (filter by kind/priority + search via params). */
export function useModerationList(params: ModerationListQuery) {
  return useQuery<ModerationListResponse>({
    queryKey: queryKeys.moderation.list(params),
    queryFn: () => api.listModeration(params),
  })
}

/** GET /admin/moderation/:id — full moderation item (signals, user context, similar items, media). */
export function useModerationItem(id: string | null) {
  return useQuery<GetModerationItemResponse>({
    queryKey: queryKeys.moderation.detail(id ?? ""),
    queryFn: () => api.getModerationItem({ id: id as string }),
    enabled: !!id,
  })
}

/** Invalidate every moderation view (list + detail) plus the home + activity aggregates after a write. */
function invalidateModeration(qc: ReturnType<typeof useQueryClient>, id?: string) {
  if (id) qc.invalidateQueries({ queryKey: queryKeys.moderation.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.moderation.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
  qc.invalidateQueries({ queryKey: queryKeys.activity.all })
}

/** POST /admin/moderation/:id/approve — approve / publish a held item (clears it from the queue). */
export function useApproveModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ApproveModerationRequest) => api.approveModeration(input),
    onSuccess: (_res, { id }) => invalidateModeration(qc, id),
  })
}

/** POST /admin/moderation/:id/remove — remove / reject a held item (clears it from the queue). */
export function useRemoveModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RemoveModerationRequest) => api.removeModeration(input),
    onSuccess: (_res, { id }) => invalidateModeration(qc, id),
  })
}

/** POST /admin/moderation/:id/hold — extend the hold on an item. */
export function useHoldModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: HoldModerationRequest) => api.holdModeration(input),
    onSuccess: (_res, { id }) => invalidateModeration(qc, id),
  })
}

/** POST /admin/moderation/:id/appeal — decide an appeal (uphold / overturn the original action). */
export function useAppealModeration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AppealModerationRequest) => api.appealModeration(input),
    onSuccess: (_res, { id }) => invalidateModeration(qc, id),
  })
}

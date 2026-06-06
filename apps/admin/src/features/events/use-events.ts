"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminEventListQuery,
  AdminEventListResponse,
  CancelRequest,
  FlagEventRequest,
  GetAdminEventResponse,
  PostMessageRequest,
  SetEventStatusRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

/**
 * Data hooks for the Events (cleanups) section (enumeration 2.D). Reads use GET /admin/events (list) and
 * GET /admin/events/:id (detail); writes use set-status / flag / cancel / post-message. Every mutation
 * invalidates the events caches plus the cross-cutting home + activity feeds, per the scaffold's
 * documented pattern.
 *
 * Query keys: reuses the existing registry (events.list/detail/all). No local keys were needed.
 */

/** GET /admin/events - the event list (filter by status + flagged + search via params). */
export function useEventList(params: AdminEventListQuery) {
  return useQuery<AdminEventListResponse>({
    queryKey: queryKeys.events.list(params),
    queryFn: () => api.listAdminEvents(params),
  })
}

/** GET /admin/events/:id - full event (desc, address, timeline, attendee messages, turnout). */
export function useEvent(id: string | null) {
  return useQuery<GetAdminEventResponse>({
    queryKey: queryKeys.events.detail(id ?? ""),
    queryFn: () => api.getAdminEvent({ id: id as string }),
    enabled: !!id,
  })
}

/** Invalidate every event view plus the home + activity aggregates after a write. */
function invalidateEvents(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: queryKeys.events.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.events.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
  qc.invalidateQueries({ queryKey: queryKeys.activity.all })
}

/** POST /admin/events/:id/status - set the cleanup status. */
export function useSetEventStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetEventStatusRequest) => api.setEventStatus(input),
    onSuccess: (_res, { id }) => invalidateEvents(qc, id),
  })
}

/** POST /admin/events/:id/flag - flag / unflag an event. */
export function useFlagEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FlagEventRequest) => api.flagEvent(input),
    onSuccess: (_res, { id }) => invalidateEvents(qc, id),
  })
}

/** POST /admin/events/:id/cancel - cancel an event (-> cancelled). */
export function useCancelEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CancelRequest) => api.cancelEvent(input),
    onSuccess: (_res, { id }) => invalidateEvents(qc, id),
  })
}

/** POST /admin/events/:id/message - post an update to the cleanup attendees. */
export function usePostEventMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PostMessageRequest) => api.postEventMessage(input),
    onSuccess: (_res, { id }) => invalidateEvents(qc, id),
  })
}

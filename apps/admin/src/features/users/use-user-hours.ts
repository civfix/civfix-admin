"use client"

import {
  mutationOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import type { AdminUserHoursResponse, AdminVoidUserHoursRequest } from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

export function useUserHours(id: string) {
  return useInfiniteQuery<AdminUserHoursResponse>({
    queryKey: queryKeys.users.hours(id),
    queryFn: ({ pageParam }) =>
      api.getUserHours({
        id,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

/** `eventId` is the voided row's event, whose hours block must refetch; it never reaches the API. */
export type VoidUserHoursInput = AdminVoidUserHoursRequest & { eventId: string | null }

export function voidUserHoursOptions(qc: ReturnType<typeof useQueryClient>) {
  return mutationOptions({
    mutationFn: ({ id, entryId, reason }: VoidUserHoursInput) =>
      api.voidUserHours({ id, entryId, reason }),
    onSuccess: (_res, { id, eventId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.users.hours(id) })
      qc.invalidateQueries({ queryKey: queryKeys.users.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.audit.all })
      if (eventId) qc.invalidateQueries({ queryKey: queryKeys.events.detail(eventId) })
    },
  })
}

export function useVoidUserHours() {
  const qc = useQueryClient()
  return useMutation(voidUserHoursOptions(qc))
}

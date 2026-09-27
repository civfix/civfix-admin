"use client"

import {
  mutationOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import type { AdminUserHoursResponse, AdminVoidUserHoursRequest } from "@civfix/shared"

import { confirmDialog } from "@/components/shared/dialog"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { useUiStore } from "@/store/ui-store"
import {
  REVOKE_CERTIFICATE_COMMAND,
  affectedCertificateLine,
  voidedToast,
} from "@/features/users/user-hours"

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

/**
 * The extra fields never reach the API. `eventId` is the voided row's event, whose hours block must
 * refetch; `userName` and `hours` word the follow-up, which runs here rather than in the panel so it
 * survives the panel unmounting mid-request: the affected certificate codes exist only in this response,
 * and a second void of the same entry is a CONFLICT.
 */
export type VoidUserHoursInput = AdminVoidUserHoursRequest & {
  eventId: string | null
  userName: string
  hours: number
}

export function voidUserHoursOptions(qc: ReturnType<typeof useQueryClient>) {
  return mutationOptions({
    mutationFn: ({ id, entryId, reason }: VoidUserHoursInput) =>
      api.voidUserHours({ id, entryId, reason }),
    onSuccess: (res, { id, eventId, userName, hours }) => {
      qc.invalidateQueries({ queryKey: queryKeys.users.hours(id) })
      qc.invalidateQueries({ queryKey: queryKeys.users.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.audit.all })
      if (eventId) qc.invalidateQueries({ queryKey: queryKeys.events.detail(eventId) })
      useUiStore.getState().showToast(voidedToast(userName, hours))
      if (res.affectedCertificates.length === 0) return
      void confirmDialog({
        title: "Issued transcripts still list this entry",
        body: `These transcripts still verify with the old total until they are revoked. Revoke each one from the backend with: ${REVOKE_CERTIFICATE_COMMAND}`,
        details: res.affectedCertificates.map(affectedCertificateLine),
        confirmLabel: "Done",
        acknowledgeOnly: true,
      })
    },
  })
}

export function useVoidUserHours() {
  const qc = useQueryClient()
  return useMutation(voidUserHoursOptions(qc))
}

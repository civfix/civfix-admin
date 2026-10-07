"use client"

import {
  mutationOptions,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import type {
  AdminCreditUserHoursRequest,
  AdminUserHoursResponse,
  AdminVoidUserHoursRequest,
} from "@civfix/shared"

import { confirmDialog } from "@/components/shared/dialog"
import { api } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { invalidateKeys, queryKeys } from "@/lib/query"
import { useUiStore } from "@/store/ui-store"
import {
  REVOKE_CERTIFICATE_COMMAND,
  affectedCertificateLine,
  creditedToast,
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

function invalidateLedger(
  qc: ReturnType<typeof useQueryClient>,
  userId: string,
  eventId: string | null,
) {
  return invalidateKeys(qc, [
    queryKeys.users.hours(userId),
    queryKeys.users.detail(userId),
    queryKeys.audit.all,
    eventId ? queryKeys.events.detail(eventId) : null,
  ])
}

/**
 * Only `request` reaches the API. The toast runs here rather than in the form so a credit that lands
 * after the form unmounted is still announced. `showsErrorInline` reports whether the form that sent
 * the credit is still mounted to render a failure next to its fields; when it is not, the failure
 * falls back to the toast instead of vanishing.
 */
export interface CreditUserHoursInput {
  request: AdminCreditUserHoursRequest
  userName: string
  showsErrorInline: () => boolean
}

export function creditUserHoursOptions(qc: ReturnType<typeof useQueryClient>) {
  return mutationOptions({
    mutationFn: ({ request }: CreditUserHoursInput) => api.creditUserHours(request),
    onSuccess: (_res, { request, userName }) => {
      void invalidateLedger(qc, request.id, request.kind === "event" ? request.eventId : null)
      useUiStore.getState().showToast(creditedToast(userName, request.hours))
    },
    meta: {
      errorMessage: (err: unknown, { showsErrorInline }: CreditUserHoursInput) =>
        showsErrorInline() ? null : errorMessage(err),
    },
  })
}

export function useCreditUserHours() {
  const qc = useQueryClient()
  return useMutation(creditUserHoursOptions(qc))
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
      void invalidateLedger(qc, id, eventId)
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

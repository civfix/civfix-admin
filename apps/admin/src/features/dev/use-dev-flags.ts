"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ErrorCode,
  type AdminListRuntimeFlagsResponse,
  type AdminSetRuntimeFlagRequest,
} from "@civfix/contract"

import { api, toAppError } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { invalidateKeys, queryKeys } from "@/lib/query"
import { useDevToast } from "@/features/dev/dev-toast"

export function useRuntimeFlags() {
  return useQuery<AdminListRuntimeFlagsResponse>({
    queryKey: queryKeys.dev.flags,
    queryFn: () => api.adminListRuntimeFlags(),
  })
}

export function isValidationError(error: unknown): boolean {
  return toAppError(error).code === ErrorCode.VALIDATION
}

/** With `fieldErrors`, the caller shows a refused value under its field instead of in the toast. */
export function useSetRuntimeFlag({ fieldErrors }: { fieldErrors: boolean }) {
  const qc = useQueryClient()
  const toast = useDevToast()
  return useMutation({
    mutationFn: (input: AdminSetRuntimeFlagRequest) => api.adminSetRuntimeFlag(input),
    // The shell's toast, where the global handler sends errors, is not on this page.
    meta: { errorToast: false },
    onSuccess: () => invalidateKeys(qc, [queryKeys.dev.all, queryKeys.audit.all]),
    onError: (error) => {
      if (!(fieldErrors && isValidationError(error))) toast(errorMessage(error), "error")
    },
  })
}

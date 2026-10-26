"use client"

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query"
import type {
  AdminDevForceUpdateListResponse,
  AdminDevResetFirstRunRequest,
  AdminDevSetForceUpdateRequest,
  AdminDevTestEmailResponse,
  AdminDevTestPushRequest,
} from "@civfix/contract"

import { api } from "@/lib/api"
import { invalidateKeys, queryKeys } from "@/lib/query"

/** Only mounted while dev tools are on: with them off the API answers NOT_FOUND. */
export function useDevForceUpdate() {
  return useQuery<AdminDevForceUpdateListResponse>({
    queryKey: queryKeys.dev.forceUpdate,
    queryFn: () => api.adminDevListForceUpdate(),
  })
}

/** Each tool writes an audit row; its card shows its own result and error, so nothing is toasted. */
function useDevTool<I, O>(mutationFn: (input: I) => Promise<O>, refresh: readonly QueryKey[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { errorToast: false },
    onSuccess: () => invalidateKeys(qc, refresh),
  })
}

export function useSetDevForceUpdate() {
  return useDevTool(
    (input: AdminDevSetForceUpdateRequest) => api.adminDevSetForceUpdate(input),
    [queryKeys.dev.all, queryKeys.audit.all],
  )
}

export function useDevTestPush() {
  return useDevTool((input: AdminDevTestPushRequest) => api.adminDevTestPush(input), [queryKeys.audit.all])
}

export function useDevTestEmail() {
  return useDevTool<void, AdminDevTestEmailResponse>(() => api.adminDevTestEmail({}), [queryKeys.audit.all])
}

export function useDevResetFirstRun() {
  return useDevTool(
    (input: AdminDevResetFirstRunRequest) => api.adminDevResetFirstRun(input),
    [queryKeys.audit.all],
  )
}

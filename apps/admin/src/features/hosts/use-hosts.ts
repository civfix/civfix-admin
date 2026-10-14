"use client"

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  AdminBroadcastListQuery,
  AdminHostListQuery,
  SetHostMessagingSuspendedRequest,
  SetHostMessagingSuspendedResponse,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { infiniteListOptions } from "@/lib/infinite"
import { invalidateKeys, queryKeys } from "@/lib/query"

export function useHostListInfinite(params: AdminHostListQuery) {
  return useInfiniteQuery(
    infiniteListOptions(queryKeys.hosts.list(params), params, (input) => api.adminListHosts(input)),
  )
}

export function useBroadcastListInfinite(params: AdminBroadcastListQuery) {
  return useInfiniteQuery(
    infiniteListOptions(queryKeys.hosts.broadcasts(params), params, (input) =>
      api.adminListBroadcasts(input),
    ),
  )
}

export interface SetHostMessagingSuspendedVariables {
  request: SetHostMessagingSuspendedRequest
  hostName: string
}

export function useSetHostMessagingSuspended() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ request }: SetHostMessagingSuspendedVariables) =>
      api.adminSetHostMessagingSuspended(request),
    onSuccess: (_res, { request: { id } }) =>
      invalidateKeys(qc, [
        queryKeys.hosts.all,
        queryKeys.users.detail(id),
        queryKeys.users.all,
        queryKeys.audit.all,
      ]),
    meta: {
      successMessage: (
        { suspended }: SetHostMessagingSuspendedResponse,
        { hostName }: SetHostMessagingSuspendedVariables,
      ) => (suspended ? `Messaging suspended · ${hostName}` : `Messaging restored · ${hostName}`),
    },
  })
}

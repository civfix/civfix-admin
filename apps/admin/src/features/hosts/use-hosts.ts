"use client"

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type {
  AdminBroadcastListQuery,
  AdminBroadcastListResponse,
  AdminHostListQuery,
  AdminHostListResponse,
  SetHostMessagingSuspendedRequest,
  SetHostMessagingSuspendedResponse,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

export function useAdminHostsInfinite(params: AdminHostListQuery) {
  return useInfiniteQuery<AdminHostListResponse>({
    queryKey: queryKeys.hosts.list(params),
    queryFn: ({ pageParam }) =>
      api.adminListHosts({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useAdminBroadcastsInfinite(params: AdminBroadcastListQuery) {
  return useInfiniteQuery<AdminBroadcastListResponse>({
    queryKey: queryKeys.hosts.broadcasts(params),
    queryFn: ({ pageParam }) =>
      api.adminListBroadcasts({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
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
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.hosts.all }),
        qc.invalidateQueries({ queryKey: queryKeys.users.detail(id) }),
        qc.invalidateQueries({ queryKey: queryKeys.users.all }),
        qc.invalidateQueries({ queryKey: queryKeys.audit.all }),
      ]),
    meta: {
      successMessage: (
        { suspended }: SetHostMessagingSuspendedResponse,
        { hostName }: SetHostMessagingSuspendedVariables,
      ) => (suspended ? `Messaging suspended · ${hostName}` : `Messaging restored · ${hostName}`),
    },
  })
}

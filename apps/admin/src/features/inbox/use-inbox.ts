"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  GetInboxMessageResponse,
  InboxListQuery,
  InboxListResponse,
  SetInboxStatusRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"


export function useInboxList(params: InboxListQuery) {
  return useQuery<InboxListResponse>({
    queryKey: queryKeys.inbox.list(params),
    queryFn: () => api.listInbox(params),
  })
}

export function useInboxListInfinite(params: InboxListQuery) {
  return useInfiniteQuery<InboxListResponse>({
    queryKey: queryKeys.inbox.list(params),
    queryFn: ({ pageParam }) =>
      api.listInbox({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useInboxMessage(id: string | null) {
  return useQuery<GetInboxMessageResponse>({
    queryKey: queryKeys.inbox.detail(id ?? ""),
    queryFn: () => api.getInboxMessage({ id: id as string }),
    enabled: !!id,
  })
}

function invalidateInbox(qc: ReturnType<typeof useQueryClient>, id?: string) {
  if (id) qc.invalidateQueries({ queryKey: queryKeys.inbox.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.inbox.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
}

export function useSetInboxStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetInboxStatusRequest) => api.setInboxStatus(input),
    onSuccess: (_res, { id }) => invalidateInbox(qc, id),
  })
}

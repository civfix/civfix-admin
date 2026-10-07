"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import type {
  GetInboxMessageResponse,
  InboxFeedQuery,
  InboxListQuery,
  InboxListResponse,
  SetInboxStatusRequest,
} from "@civfix/shared"

import { attachmentRefreshInterval } from "@/features/inbox/attachments"
import { api } from "@/lib/api"
import { infiniteListOptions } from "@/lib/infinite"
import { invalidateKeys, queryKeys } from "@/lib/query"

export function useInboxList(params: InboxListQuery) {
  return useQuery<InboxListResponse>({
    queryKey: queryKeys.inbox.page(params),
    queryFn: () => api.listInbox(params),
  })
}

export function useInboxListInfinite(params: InboxListQuery) {
  return useInfiniteQuery(
    infiniteListOptions(queryKeys.inbox.list(params), params, (input) => api.listInbox(input)),
  )
}

export function inboxFeedQueryOptions(params: InboxFeedQuery) {
  return infiniteListOptions(queryKeys.inbox.feed(params), params, (input) =>
    api.listInboxFeed(input),
  )
}

export function useInboxFeedInfinite(params: InboxFeedQuery) {
  return useInfiniteQuery(inboxFeedQueryOptions(params))
}

export function useInboxMessage(id: string | null) {
  return useQuery<GetInboxMessageResponse>({
    queryKey: queryKeys.inbox.detail(id ?? ""),
    queryFn: () => api.getInboxMessage({ id: id as string }),
    enabled: !!id,
    refetchInterval: (query) => attachmentRefreshInterval(query.state.data?.attachments.length ?? 0),
  })
}

function invalidateInbox(qc: QueryClient, id?: string) {
  return invalidateKeys(qc, [
    id ? queryKeys.inbox.detail(id) : null,
    queryKeys.inbox.all,
    queryKeys.home.all,
  ])
}

const STATUS_TOAST: Record<SetInboxStatusRequest["status"], string | null> = {
  unread: null,
  read: "Marked read",
  archived: "Archived",
}

/** `quiet` is for a status change the operator did not ask for, such as reading a message by opening it. */
export function useSetInboxStatus({ quiet = false }: { quiet?: boolean } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetInboxStatusRequest) => api.setInboxStatus(input),
    onSuccess: (_res, { id }) => invalidateInbox(qc, id),
    meta: {
      successMessage: (_res: unknown, { status }: SetInboxStatusRequest) =>
        quiet ? null : STATUS_TOAST[status],
    },
  })
}

"use client"

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type {
  AdminUserListQuery,
  AdminUserListResponse,
  FlagUserRequest,
  GetAdminUserResponse,
  RemoveUserMessageRequest,
  SetUserReportVerifiedRequest,
  SetUserStatusRequest,
  UserEventsResponse,
  UserMessagesResponse,
  UserReportsResponse,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

/**
 * One flat page of users (home preview, the org user picker). Keyed under `users.page`, not
 * `users.list`, so its plain response can never land in — or be read as — the users page's infinite
 * cache entry for the same params. `keepPreviousData` holds the last results while a new search runs.
 */
export function useUserList(params: AdminUserListQuery, opts: { keepPreviousData?: boolean } = {}) {
  return useQuery<AdminUserListResponse>({
    queryKey: queryKeys.users.page(params),
    queryFn: () => api.listAdminUsers(params),
    ...(opts.keepPreviousData ? { placeholderData: keepPreviousData } : {}),
  })
}

export function useUserListInfinite(params: AdminUserListQuery) {
  return useInfiniteQuery<AdminUserListResponse>({
    queryKey: queryKeys.users.list(params),
    queryFn: ({ pageParam }) =>
      api.listAdminUsers({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useUser(id: string | null) {
  return useQuery<GetAdminUserResponse>({
    queryKey: queryKeys.users.detail(id ?? ""),
    queryFn: () => api.getAdminUser({ id: id as string }),
    enabled: !!id,
  })
}

// A profile tab's badge counts everything the user has, so each tab pages through the whole history
// rather than stopping at the API's first page.
function useUserSubList<T extends { nextCursor?: string | null }>(
  queryKey: readonly unknown[],
  id: string | null,
  fetchPage: (input: { id: string; cursor?: string }) => Promise<T>,
) {
  return useInfiniteQuery<T>({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchPage({ id: id as string, ...(typeof pageParam === "string" ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!id,
  })
}

export function useUserReports(id: string | null) {
  return useUserSubList<UserReportsResponse>(queryKeys.users.reports(id ?? ""), id, (input) =>
    api.getUserReports(input),
  )
}

export function useUserEvents(id: string | null) {
  return useUserSubList<UserEventsResponse>(queryKeys.users.events(id ?? ""), id, (input) =>
    api.getUserEvents(input),
  )
}

export function useUserMessages(id: string | null) {
  return useUserSubList<UserMessagesResponse>(queryKeys.users.messages(id ?? ""), id, (input) =>
    api.getUserMessages(input),
  )
}

function invalidateUsers(qc: ReturnType<typeof useQueryClient>, id: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.users.detail(id) }),
    qc.invalidateQueries({ queryKey: queryKeys.users.all }),
    qc.invalidateQueries({ queryKey: queryKeys.home.all }),
  ])
}

export function useFlagUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FlagUserRequest) => api.flagUser(input),
    onSuccess: (_res, { id }) => invalidateUsers(qc, id),
  })
}

export function useSetUserStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetUserStatusRequest) => api.setUserStatus(input),
    onSuccess: (_res, { id }) => invalidateUsers(qc, id),
  })
}

export function useSetUserReportVerified() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetUserReportVerifiedRequest) => api.setUserReportVerified(input),
    onSuccess: (_res, { id }) => invalidateUsers(qc, id),
  })
}

export function useRemoveUserMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RemoveUserMessageRequest) => api.removeUserMessage(input),
    onSuccess: (_res, { id }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.users.messages(id) }),
        invalidateUsers(qc, id),
      ]),
  })
}


"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminUserListQuery,
  AdminUserListResponse,
  FlagUserRequest,
  GetAdminUserResponse,
  RemoveUserMessageRequest,
  SetRoleRequest,
  SetUserReportVerifiedRequest,
  SetUserStatusRequest,
  SetUserVerifiedRequest,
  UserEventsResponse,
  UserMessagesResponse,
  UserReportsResponse,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"


export function useUserList(params: AdminUserListQuery) {
  return useQuery<AdminUserListResponse>({
    queryKey: queryKeys.users.list(params),
    queryFn: () => api.listAdminUsers(params),
  })
}

export function useUser(id: string | null) {
  return useQuery<GetAdminUserResponse>({
    queryKey: queryKeys.users.detail(id ?? ""),
    queryFn: () => api.getAdminUser({ id: id as string }),
    enabled: !!id,
  })
}

export function useUserReports(id: string | null) {
  return useQuery<UserReportsResponse>({
    queryKey: queryKeys.users.reports(id ?? ""),
    queryFn: () => api.getUserReports({ id: id as string }),
    enabled: !!id,
  })
}

export function useUserEvents(id: string | null) {
  return useQuery<UserEventsResponse>({
    queryKey: queryKeys.users.events(id ?? ""),
    queryFn: () => api.getUserEvents({ id: id as string }),
    enabled: !!id,
  })
}

export function useUserMessages(id: string | null) {
  return useQuery<UserMessagesResponse>({
    queryKey: queryKeys.users.messages(id ?? ""),
    queryFn: () => api.getUserMessages({ id: id as string }),
    enabled: !!id,
  })
}

function invalidateUsers(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: queryKeys.users.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.users.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
  qc.invalidateQueries({ queryKey: queryKeys.activity.all })
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

export function useSetUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetRoleRequest) => api.setUserRole(input),
    onSuccess: (_res, { id }) => invalidateUsers(qc, id),
  })
}

export function useSetUserVerified() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetUserVerifiedRequest) => api.setUserVerified(input),
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
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.users.messages(id) })
      invalidateUsers(qc, id)
    },
  })
}


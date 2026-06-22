"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminUserListQuery,
  AdminUserListResponse,
  FlagUserRequest,
  GetAdminUserResponse,
  RemoveUserMessageRequest,
  SetUserReportVerifiedRequest,
  SetUserStatusRequest,
  SetUserVerifiedRequest,
  UserEventsResponse,
  UserMessagesResponse,
  UserReportsResponse,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

/**
 * Data hooks for the Users section (enumeration 2.F). Reads use GET /admin/users (list), GET
 * /admin/users/:id (detail), and the three sub-activity lists (reports / events / messages). Writes use
 * flag / set-status (ban) / set-role. Every mutation invalidates the users caches plus the cross-cutting
 * home + activity feeds (a flag/status change moves the dashboard aggregates and the activity feed), per
 * the scaffold's documented pattern.
 *
 * Query keys: reuses the existing registry (users.list/detail/reports/events/messages + users.all). No
 * local keys were needed.
 */

/** GET /admin/users - the account list (filter active/suspended/flagged + search via params). */
export function useUserList(params: AdminUserListQuery) {
  return useQuery<AdminUserListResponse>({
    queryKey: queryKeys.users.list(params),
    queryFn: () => api.listAdminUsers(params),
  })
}

/** GET /admin/users/:id - full user (profile + counts + risk + role). */
export function useUser(id: string | null) {
  return useQuery<GetAdminUserResponse>({
    queryKey: queryKeys.users.detail(id ?? ""),
    queryFn: () => api.getAdminUser({ id: id as string }),
    enabled: !!id,
  })
}

/** GET /admin/users/:id/reports - the user's filed reports (Reports tab). */
export function useUserReports(id: string | null) {
  return useQuery<UserReportsResponse>({
    queryKey: queryKeys.users.reports(id ?? ""),
    queryFn: () => api.getUserReports({ id: id as string }),
    enabled: !!id,
  })
}

/** GET /admin/users/:id/events - the user's cleanup memberships (Events tab). */
export function useUserEvents(id: string | null) {
  return useQuery<UserEventsResponse>({
    queryKey: queryKeys.users.events(id ?? ""),
    queryFn: () => api.getUserEvents({ id: id as string }),
    enabled: !!id,
  })
}

/** GET /admin/users/:id/messages - the user's chat messages (Messages tab). */
export function useUserMessages(id: string | null) {
  return useQuery<UserMessagesResponse>({
    queryKey: queryKeys.users.messages(id ?? ""),
    queryFn: () => api.getUserMessages({ id: id as string }),
    enabled: !!id,
  })
}

/** Invalidate every user view plus the home + activity aggregates after a write. */
function invalidateUsers(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: queryKeys.users.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.users.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
  qc.invalidateQueries({ queryKey: queryKeys.activity.all })
}

/** POST /admin/users/:id/flag - flag / unflag an account. */
export function useFlagUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FlagUserRequest) => api.flagUser(input),
    onSuccess: (_res, { id }) => invalidateUsers(qc, id),
  })
}

/** POST /admin/users/:id/status - set the account status (ban / suspend / review / reactivate). */
export function useSetUserStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetUserStatusRequest) => api.setUserStatus(input),
    onSuccess: (_res, { id }) => invalidateUsers(qc, id),
  })
}

/**
 * POST /admin/users/:id/verify - set the "verified neighbor" status directly (operators do this after a
 * verification call; there is no application queue). Invalidates the user caches so the detail's verified
 * pill updates immediately.
 */
export function useSetUserVerified() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetUserVerifiedRequest) => api.setUserVerified(input),
    onSuccess: (_res, { id }) => invalidateUsers(qc, id),
  })
}

/**
 * POST /admin/users/:id/report-verify - set the account's "report-verified" trust state directly (a
 * distinct axis from the verified-neighbor toggle above). Invalidates the user caches so the detail's
 * report-verified badge updates immediately. Mirrors useSetUserVerified.
 */
export function useSetUserReportVerified() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetUserReportVerifiedRequest) => api.setUserReportVerified(input),
    onSuccess: (_res, { id }) => invalidateUsers(qc, id),
  })
}

/**
 * POST /admin/users/:id/messages/:messageId/remove - operator soft-delete of one of a user's chat
 * messages (audited; optional reason). On success we invalidate THIS user's messages list (the removed
 * message re-renders as a tombstone), the user detail + list aggregates (the messages count / activity
 * may shift), plus the cross-cutting home + activity feeds (a removal is an operator action). Mirrors
 * useRemoveDiscussionMessage in use-reports.ts.
 */
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


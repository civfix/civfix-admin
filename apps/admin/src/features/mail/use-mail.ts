"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  ComposeRequest,
  GetMailThreadResponse,
  MailListQuery,
  MailListResponse,
  MailStatsResponse,
  MarkMailReadRequest,
  ReplyRequest,
  ResendRequest,
  SetMailStatusRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

/**
 * Data hooks for the Mail section (enumeration 2.E). Reads: GET /admin/mail (thread list), GET
 * /admin/mail/:id (reader thread), GET /admin/mail/stats (deliverability strip). Writes: compose /
 * reply / mark-read / set-status / resend. Every mutation invalidates the mail caches (list + detail +
 * stats) plus the cross-cutting home + activity feeds (a send/reply/status change moves the dashboard
 * aggregates and the activity feed), per the scaffold's documented pattern.
 *
 * Query keys: reuses the existing registry (mail.list/detail/all/stats). No local keys were needed.
 */

/** GET /admin/mail - the thread list (filter dir + needs-attention + geoid + search via params). */
export function useMailList(params: MailListQuery) {
  return useQuery<MailListResponse>({
    queryKey: queryKeys.mail.list(params),
    queryFn: () => api.listMail(params),
  })
}

/** GET /admin/mail/:id - full thread (the ordered in/out messages). */
export function useMailThread(id: string | null) {
  return useQuery<GetMailThreadResponse>({
    queryKey: queryKeys.mail.detail(id ?? ""),
    queryFn: () => api.getMailThread({ id: id as string }),
    enabled: !!id,
  })
}

/** GET /admin/mail/stats - the 7-day deliverability stats (placement, delivered, bounce, unread). */
export function useMailStats() {
  return useQuery<MailStatsResponse>({
    queryKey: queryKeys.mail.stats,
    queryFn: () => api.getMailStats(),
  })
}

/** Invalidate every mail view (list + detail + stats) plus the home + activity aggregates. */
function invalidateMail(qc: ReturnType<typeof useQueryClient>, id?: string) {
  if (id) qc.invalidateQueries({ queryKey: queryKeys.mail.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.mail.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
  qc.invalidateQueries({ queryKey: queryKeys.activity.all })
}

/** POST /admin/mail - compose a new outbound thread (from is fixed server-side). */
export function useComposeMail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ComposeRequest) => api.composeMail(input),
    onSuccess: () => invalidateMail(qc),
  })
}

/** POST /admin/mail/:id/reply - append an outbound reply to a thread. */
export function useReplyMail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ReplyRequest) => api.replyMail(input),
    onSuccess: (_res, { id }) => invalidateMail(qc, id),
  })
}

/** POST /admin/mail/:id/read - mark a thread read (fired when a row is opened). */
export function useMarkMailRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MarkMailReadRequest) => api.markMailRead(input),
    onSuccess: (_res, { id }) => invalidateMail(qc, id),
  })
}

/** POST /admin/mail/:id/status - set a thread's triage status ("Mark done" -> replied). */
export function useSetMailStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetMailStatusRequest) => api.setMailStatus(input),
    onSuccess: (_res, { id }) => invalidateMail(qc, id),
  })
}

/** POST /admin/mail/:id/resend - resend a bounced/outbound message ("Resend" / "Fix routing"). */
export function useResendMail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ResendRequest) => api.resendMail(input),
    onSuccess: (_res, { id }) => invalidateMail(qc, id),
  })
}

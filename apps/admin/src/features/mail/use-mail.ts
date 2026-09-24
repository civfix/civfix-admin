"use client"

import {
  mutationOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import type {
  ComposeRequest,
  GetForwardTemplateDefaultResponse,
  GetMailThreadResponse,
  MailListQuery,
  MailListResponse,
  MailStatsResponse,
  MarkMailReadRequest,
  PreviewForwardTemplateRequest,
  PreviewForwardTemplateResponse,
  PublishMailReplyRequest,
  PublishMailReplyResponse,
  ReplyRequest,
  ResendRequest,
  SetForwardTemplateDefaultRequest,
  SetMailStatusRequest,
} from "@civfix/shared"

import { attachmentRefreshInterval } from "@/features/inbox/attachments"
import { PUBLISH_TOAST } from "@/features/mail/mail-presentation"
import { api } from "@/lib/api"
import { infiniteListOptions } from "@/lib/infinite"
import { invalidateKeys, queryKeys } from "@/lib/query"

export function useMailList(params: MailListQuery) {
  return useQuery<MailListResponse>({
    queryKey: queryKeys.mail.page(params),
    queryFn: () => api.listMail(params),
  })
}

export function useMailListInfinite(params: MailListQuery) {
  return useInfiniteQuery(
    infiniteListOptions(queryKeys.mail.list(params), params, (input) => api.listMail(input)),
  )
}

export function useMailThread(id: string | null) {
  return useQuery<GetMailThreadResponse>({
    queryKey: queryKeys.mail.detail(id ?? ""),
    queryFn: () => api.getMailThread({ id: id as string }),
    enabled: !!id,
    refetchInterval: (query) =>
      attachmentRefreshInterval(
        query.state.data?.messages.reduce((n, m) => n + m.attachments.length, 0) ?? 0,
      ),
  })
}

export function useMailStats() {
  return useQuery<MailStatsResponse>({
    queryKey: queryKeys.mail.stats,
    queryFn: () => api.getMailStats(),
  })
}

export function invalidateMail(qc: QueryClient, id?: string) {
  return invalidateKeys(qc, [
    id ? queryKeys.mail.detail(id) : null,
    queryKeys.mail.all,
    queryKeys.mail.stats,
    queryKeys.inbox.all,
    queryKeys.home.all,
  ])
}

export function useComposeMail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ComposeRequest) => api.composeMail(input),
    onSuccess: () => invalidateMail(qc),
    meta: { successMessage: (_res: unknown, { to }: ComposeRequest) => `Message sent to ${to}` },
  })
}

export interface ReplyMailVariables {
  request: ReplyRequest
  /** Who the reply goes to, as the thread names them. */
  recipient: string
}

export function useReplyMail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ request }: ReplyMailVariables) => api.replyMail(request),
    onSuccess: (_res, { request }) => invalidateMail(qc, request.id),
    meta: {
      successMessage: (_res: unknown, { recipient }: ReplyMailVariables) => `Reply sent to ${recipient}`,
    },
  })
}

export function useMarkMailRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MarkMailReadRequest) => api.markMailRead(input),
    onSuccess: (_res, { id }) => invalidateMail(qc, id),
  })
}

export function useSetMailStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetMailStatusRequest) => api.setMailStatus(input),
    onSuccess: (_res, { id }) => invalidateMail(qc, id),
    meta: {
      successMessage: (_res: unknown, { status }: SetMailStatusRequest) =>
        status === "replied" ? "Marked replied" : null,
    },
  })
}

export function useResendMail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ResendRequest) => api.resendMail(input),
    onSuccess: (_res, { id }) => invalidateMail(qc, id),
    meta: { successMessage: () => "Message resent" },
  })
}

export function publishMailReplyOptions(qc: QueryClient) {
  return mutationOptions({
    mutationFn: (input: PublishMailReplyRequest) => api.publishMailReply(input),
    onSuccess: (_res, { id }) =>
      Promise.all([
        invalidateMail(qc, id),
        qc.invalidateQueries({ queryKey: queryKeys.reports.all }),
        qc.invalidateQueries({ queryKey: queryKeys.events.all }),
      ]),
    meta: {
      successMessage: (res: PublishMailReplyResponse) => PUBLISH_TOAST[res.publication],
    },
  })
}

export function usePublishMailReply() {
  const qc = useQueryClient()
  return useMutation(publishMailReplyOptions(qc))
}

export function useForwardTemplateDefault() {
  return useQuery<GetForwardTemplateDefaultResponse>({
    queryKey: queryKeys.mail.forwardTemplate,
    queryFn: () => api.getForwardTemplateDefault(),
  })
}

export function useSetForwardTemplateDefault() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetForwardTemplateDefaultRequest) => api.setForwardTemplateDefault(input),
    onSuccess: (res) => {
      qc.setQueryData(queryKeys.mail.forwardTemplate, res)
    },
    meta: { successMessage: () => "Default template saved" },
  })
}

export function usePreviewForwardTemplate() {
  return useMutation<PreviewForwardTemplateResponse, unknown, PreviewForwardTemplateRequest>({
    mutationFn: (input) => api.previewForwardTemplate(input),
    meta: { errorToast: false },
  })
}

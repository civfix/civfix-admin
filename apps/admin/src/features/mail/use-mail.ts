"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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


export function useMailList(params: MailListQuery) {
  return useQuery<MailListResponse>({
    queryKey: queryKeys.mail.list(params),
    queryFn: () => api.listMail(params),
  })
}

export function useMailListInfinite(params: MailListQuery) {
  return useInfiniteQuery<MailListResponse>({
    queryKey: queryKeys.mail.list(params),
    queryFn: ({ pageParam }) =>
      api.listMail({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useMailThread(id: string | null) {
  return useQuery<GetMailThreadResponse>({
    queryKey: queryKeys.mail.detail(id ?? ""),
    queryFn: () => api.getMailThread({ id: id as string }),
    enabled: !!id,
  })
}

export function useMailStats() {
  return useQuery<MailStatsResponse>({
    queryKey: queryKeys.mail.stats,
    queryFn: () => api.getMailStats(),
  })
}

function invalidateMail(qc: ReturnType<typeof useQueryClient>, id?: string) {
  if (id) qc.invalidateQueries({ queryKey: queryKeys.mail.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.mail.all })
  qc.invalidateQueries({ queryKey: queryKeys.mail.stats })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
  qc.invalidateQueries({ queryKey: queryKeys.activity.all })
}

export function useComposeMail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ComposeRequest) => api.composeMail(input),
    onSuccess: () => invalidateMail(qc),
  })
}

export function useReplyMail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ReplyRequest) => api.replyMail(input),
    onSuccess: (_res, { id }) => invalidateMail(qc, id),
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
  })
}

export function useResendMail() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ResendRequest) => api.resendMail(input),
    onSuccess: (_res, { id }) => invalidateMail(qc, id),
  })
}

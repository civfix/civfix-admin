"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  GetInboxMessageResponse,
  InboxListQuery,
  InboxListResponse,
  SetInboxStatusRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

/**
 * Data hooks for the Inbox section (catch-all *@civfix.org mail that is not an outreach reply). Reads:
 * GET /admin/inbox (list), GET /admin/inbox/:id (the message + body + attachment links). Write:
 * set-status (mark read / archive). The mutation invalidates the inbox caches plus the cross-cutting
 * home + activity feeds (the home tile's unread badge is derived from the list), mirroring use-mail.ts.
 */

/** GET /admin/inbox - the inbox list (filter status / recipient local-part + search via params). */
export function useInboxList(params: InboxListQuery) {
  return useQuery<InboxListResponse>({
    queryKey: queryKeys.inbox.list(params),
    queryFn: () => api.listInbox(params),
  })
}

/** GET /admin/inbox/:id - one inbound email (body + presigned attachment links). */
export function useInboxMessage(id: string | null) {
  return useQuery<GetInboxMessageResponse>({
    queryKey: queryKeys.inbox.detail(id ?? ""),
    queryFn: () => api.getInboxMessage({ id: id as string }),
    enabled: !!id,
  })
}

/** Invalidate every inbox view (list + detail) plus the home + activity aggregates. */
function invalidateInbox(qc: ReturnType<typeof useQueryClient>, id?: string) {
  if (id) qc.invalidateQueries({ queryKey: queryKeys.inbox.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.inbox.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
  qc.invalidateQueries({ queryKey: queryKeys.activity.all })
}

/** POST /admin/inbox/:id/status - set the triage status (mark read / archive). */
export function useSetInboxStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetInboxStatusRequest) => api.setInboxStatus(input),
    onSuccess: (_res, { id }) => invalidateInbox(qc, id),
  })
}

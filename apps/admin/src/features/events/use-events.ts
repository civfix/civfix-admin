"use client"

import {
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type {
  AdminEventListQuery,
  AdminEventListResponse,
  CancelRequest,
  FlagEventRequest,
  GetAdminEventResponse,
  LinkEventReportsRequest,
  PostMessageRequest,
  SetEventOutcomeRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { useUiStore } from "@/store/ui-store"
import { shortId } from "@/features/events/event-id"
import { pluralize } from "@/features/reports/plural"

function eventMessage(id: string, text: string): string {
  return `${shortId(id)} · ${text}`
}

export function useEventList(params: AdminEventListQuery) {
  return useQuery<AdminEventListResponse>({
    queryKey: queryKeys.events.page(params),
    queryFn: () => api.listAdminEvents(params),
  })
}

export function useEventListInfinite(params: AdminEventListQuery) {
  return useInfiniteQuery<AdminEventListResponse>({
    queryKey: queryKeys.events.list(params),
    queryFn: ({ pageParam }) =>
      api.listAdminEvents({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

function eventQuery(id: string) {
  return queryOptions<GetAdminEventResponse>({
    queryKey: queryKeys.events.detail(id),
    queryFn: () => api.getAdminEvent({ id }),
  })
}

export function useEvent(id: string | null) {
  return useQuery({ ...eventQuery(id ?? ""), enabled: !!id })
}

// Profiles, org event tabs and signup pages all render an event's status, turnout and flag.
function invalidateEvents(qc: ReturnType<typeof useQueryClient>, id: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.events.detail(id) }),
    qc.invalidateQueries({ queryKey: queryKeys.events.all }),
    qc.invalidateQueries({ queryKey: queryKeys.home.all }),
    qc.invalidateQueries({ queryKey: queryKeys.users.all }),
    qc.invalidateQueries({ queryKey: queryKeys.orgs.all }),
    qc.invalidateQueries({ queryKey: queryKeys.pages.all }),
  ])
}

export function useFlagEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FlagEventRequest) => api.flagEvent(input),
    // The endpoint toggles, so another operator's flag since this load flips the outcome: word the
    // toast from the event as it now is.
    onSuccess: async (_res, { id }) => {
      await invalidateEvents(qc, id)
      let event: GetAdminEventResponse
      try {
        event = await qc.fetchQuery(eventQuery(id))
      } catch {
        // The flag already changed and the refetch failed: skip the toast rather than guess its wording.
        return
      }
      useUiStore
        .getState()
        .showToast(eventMessage(id, event.flagged ? "flagged for review" : "flag cleared"))
    },
  })
}

export function useCancelEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CancelRequest) => api.cancelEvent(input),
    onSuccess: (_res, { id }) => invalidateEvents(qc, id),
    meta: {
      successMessage: (_res: unknown, { id }: CancelRequest) => eventMessage(id, "event cancelled"),
    },
  })
}

export function usePostEventMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PostMessageRequest) => api.postEventMessage(input),
    onSuccess: (_res, { id }) => invalidateEvents(qc, id),
    meta: { successMessage: () => "Update posted to attendees" },
  })
}

export function useSetEventOutcome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetEventOutcomeRequest) => api.setEventOutcome(input),
    onSuccess: (_res, { id }) => invalidateEvents(qc, id),
    meta: {
      successMessage: (_res: unknown, { bags }: SetEventOutcomeRequest) =>
        `Outcome logged · ${pluralize(bags, "bag")}`,
    },
  })
}

export function useLinkReports() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: LinkEventReportsRequest) => api.linkEventReports(input),
    onSuccess: (_res, { id }) =>
      Promise.all([
        invalidateEvents(qc, id),
        qc.invalidateQueries({ queryKey: queryKeys.reports.all }),
      ]),
    meta: {
      successMessage: (_res: unknown, { id, reportIds }: LinkEventReportsRequest) =>
        eventMessage(
          id,
          reportIds.length === 1 ? "1 report linked" : `${reportIds.length} reports linked`,
        ),
    },
  })
}

export function useUnlinkReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; reportId: string }) => api.unlinkEventReport(input),
    onSuccess: (_res, { id, reportId }) =>
      Promise.all([
        invalidateEvents(qc, id),
        qc.invalidateQueries({ queryKey: queryKeys.reports.detail(reportId) }),
        qc.invalidateQueries({ queryKey: queryKeys.reports.all }),
      ]),
    meta: {
      successMessage: (_res: unknown, { id }: { id: string }) => eventMessage(id, "report unlinked"),
    },
  })
}

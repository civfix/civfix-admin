"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import type {
  AdminEventPageListQuery,
  AdminGetEventPageResponse,
  FlagEventPageRequest,
  FlagEventPageResponse,
  UnpublishEventPageRequest,
  UnpublishEventPageResponse,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { infiniteListOptions } from "@/lib/infinite"
import { invalidateKeys, queryKeys } from "@/lib/query"
import { publicPagePath } from "@/features/pages/page-path"

export function useEventPageListInfinite(params: AdminEventPageListQuery) {
  return useInfiniteQuery(
    infiniteListOptions(queryKeys.pages.list(params), params, (input) =>
      api.adminListEventPages(input),
    ),
  )
}

export function useEventPage(cleanupId: string | null) {
  return useQuery<AdminGetEventPageResponse>({
    queryKey: queryKeys.pages.preview(cleanupId ?? ""),
    queryFn: () => api.adminGetEventPage({ id: cleanupId as string }),
    enabled: !!cleanupId,
  })
}

function pageName(page: Pick<FlagEventPageResponse, "slug" | "title">): string {
  return page.slug ? publicPagePath(page.slug) : page.title
}

function invalidatePages(qc: QueryClient, id: string) {
  return invalidateKeys(qc, [
    queryKeys.pages.all,
    queryKeys.events.all,
    queryKeys.audit.all,
    queryKeys.events.detail(id),
  ])
}

export function useFlagEventPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FlagEventPageRequest) => api.adminFlagEventPage(input),
    onSuccess: (_res, { id }) => invalidatePages(qc, id),
    meta: {
      successMessage: (page: FlagEventPageResponse, { flagged }: FlagEventPageRequest) =>
        flagged ? `Flagged · ${pageName(page)}` : "Flag cleared",
    },
  })
}

export function useUnpublishEventPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UnpublishEventPageRequest) => api.adminUnpublishEventPage(input),
    onSuccess: (_res, { id }) => invalidatePages(qc, id),
    meta: {
      successMessage: (page: UnpublishEventPageResponse) => `Unpublished · ${pageName(page)}`,
    },
  })
}

"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminGetMediaResponse,
  AdminOrgVerificationListQuery,
  AdminOrgVerificationListResponse,
  DecideOrgVerificationRequest,
  GetAdminOrgPaymentsResponse,
  GetAdminOrgResponse,
  SetOrgDonationsEnabledRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"
import {
  EVIDENCE_URL_MAX_CACHE_MS,
  evidenceUrlLifetimeMs,
} from "@/features/orgs/evidence-cache"

export function useOrgVerificationsInfinite(params: AdminOrgVerificationListQuery) {
  return useInfiniteQuery<AdminOrgVerificationListResponse>({
    queryKey: queryKeys.orgs.verifications(params),
    queryFn: ({ pageParam }) =>
      api.adminListOrgVerifications({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useAdminOrg(id: string | null) {
  return useQuery<GetAdminOrgResponse>({
    queryKey: queryKeys.orgs.detail(id ?? ""),
    queryFn: () => api.adminGetOrg({ id: id as string }),
    enabled: !!id,
  })
}

export function useAdminOrgPayments(id: string | null) {
  return useQuery<GetAdminOrgPaymentsResponse>({
    queryKey: queryKeys.orgs.payments(id ?? ""),
    queryFn: () => api.adminGetOrgPayments({ id: id as string }),
    enabled: !!id,
  })
}

export function useOrgVerificationDocument(mediaId: string | null) {
  return useQuery<AdminGetMediaResponse>({
    queryKey: queryKeys.media.document(mediaId ?? ""),
    queryFn: () => api.adminGetMedia({ id: mediaId as string }),
    enabled: !!mediaId,
    staleTime: (query) => evidenceUrlLifetimeMs(query.state.data?.expiresAt),
    gcTime: EVIDENCE_URL_MAX_CACHE_MS,
  })
}

function invalidateOrg(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: queryKeys.orgs.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.orgs.payments(id) })
  qc.invalidateQueries({ queryKey: queryKeys.orgs.all })
  qc.invalidateQueries({ queryKey: queryKeys.donations.all })
  qc.invalidateQueries({ queryKey: queryKeys.audit.all })
}

export function useDecideOrgVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: DecideOrgVerificationRequest) => api.adminDecideOrgVerification(input),
    onSuccess: (_res, { id }) => invalidateOrg(qc, id),
  })
}

export function useSetOrgDonationsEnabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetOrgDonationsEnabledRequest) => api.adminSetOrgDonationsEnabled(input),
    onSuccess: (_res, { id }) => invalidateOrg(qc, id),
  })
}

"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { GovClaimDTO, GovClaimListResponse } from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

type GovListParams = NonNullable<Parameters<typeof api.listGovClaims>[0]>
type VerifyGovInput = Parameters<typeof api.verifyGovClaim>[0]
type ApproveGovInput = Parameters<typeof api.approveGovClaim>[0]
type RejectGovInput = Parameters<typeof api.rejectGovClaim>[0]

export function useGovClaimList(params: GovListParams) {
  return useQuery<GovClaimListResponse>({
    queryKey: queryKeys.gov.list(params),
    queryFn: () => api.listGovClaims(params),
  })
}

export function useGovClaim(id: string | null) {
  return useQuery<GovClaimDTO>({
    queryKey: queryKeys.gov.detail(id ?? ""),
    queryFn: () => api.getGovClaim({ id: id as string }),
    enabled: !!id,
  })
}

function invalidateGov(qc: ReturnType<typeof useQueryClient>, id?: string) {
  if (id) qc.invalidateQueries({ queryKey: queryKeys.gov.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.gov.all })
}

export function useVerifyGovCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: VerifyGovInput) => api.verifyGovClaim(input),
    onSuccess: (_res, { id }) => invalidateGov(qc, id),
  })
}

export function useApproveGovClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ApproveGovInput) => api.approveGovClaim(input),
    onSuccess: (_res, { id }) => invalidateGov(qc, id),
  })
}

export function useRejectGovClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RejectGovInput) => api.rejectGovClaim(input),
    onSuccess: (_res, { id }) => invalidateGov(qc, id),
  })
}

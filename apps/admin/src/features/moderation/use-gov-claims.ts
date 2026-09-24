"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  ApproveGovClaimRequest,
  GetGovClaimResponse,
  GovClaimDTO,
  GovClaimListQuery,
  GovClaimListResponse,
  RejectGovClaimRequest,
  VerifyCheckRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"
import {
  govCheckLabel,
  govClaimApproveErrorMessage,
} from "@/features/moderation/gov-claim-presentation"

/**
 * Data hooks for the gov-provisioning queue (GET/POST /admin/gov-claims*). An operator verifies the
 * applicant's LinkedIn / municipal directory / phone callback, then approves — which provisions the
 * government role on the contact email's account and links the jurisdiction — or rejects with a reason.
 * Approve therefore also invalidates the users caches, since it changes an account's role.
 */

export function useGovClaimListInfinite(params: GovClaimListQuery) {
  return useInfiniteQuery<GovClaimListResponse>({
    queryKey: queryKeys.govClaims.list(params),
    queryFn: ({ pageParam }) =>
      api.listGovClaims({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useGovClaim(id: string | null) {
  return useQuery<GetGovClaimResponse>({
    queryKey: queryKeys.govClaims.detail(id ?? ""),
    queryFn: () => api.getGovClaim({ id: id as string }),
    enabled: !!id,
  })
}

function invalidateGovClaims(qc: ReturnType<typeof useQueryClient>, id: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.govClaims.detail(id) }),
    qc.invalidateQueries({ queryKey: queryKeys.govClaims.all }),
  ])
}

export function useVerifyGovClaimCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: VerifyCheckRequest) => api.verifyGovClaim(input),
    onSuccess: (_res, { id }) => invalidateGovClaims(qc, id),
    meta: {
      successMessage: (_res: unknown, { check, status }: VerifyCheckRequest) =>
        `${govCheckLabel(check)} · ${status === "verified" ? "verified" : "back to pending"}`,
    },
  })
}

/** The claim as the operator saw it, which the confirmation names. */
export interface GovClaimDecision<Request> {
  request: Request
  claim: Pick<GovClaimDTO, "name">
}

export function useApproveGovClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ request }: GovClaimDecision<ApproveGovClaimRequest>) => api.approveGovClaim(request),
    meta: {
      errorMessage: govClaimApproveErrorMessage,
      successMessage: (_res: unknown, { claim }: GovClaimDecision<ApproveGovClaimRequest>) =>
        `${claim.name} approved · government role provisioned`,
    },
    onSuccess: (_res, { request: { id } }) =>
      Promise.all([
        invalidateGovClaims(qc, id),
        qc.invalidateQueries({ queryKey: queryKeys.users.all }),
      ]),
  })
}

export function useRejectGovClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ request }: GovClaimDecision<RejectGovClaimRequest>) => api.rejectGovClaim(request),
    onSuccess: (_res, { request: { id } }) => invalidateGovClaims(qc, id),
    meta: {
      successMessage: (_res: unknown, { claim }: GovClaimDecision<RejectGovClaimRequest>) =>
        `${claim.name} rejected`,
    },
  })
}

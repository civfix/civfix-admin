"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import type {
  ApproveGovClaimRequest,
  GetGovClaimResponse,
  GovClaimDTO,
  GovClaimListQuery,
  RejectGovClaimRequest,
  VerifyCheckRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { infiniteListOptions } from "@/lib/infinite"
import { invalidateKeys, queryKeys } from "@/lib/query"
import {
  govCheckLabel,
  govClaimApproveErrorMessage,
} from "@/features/moderation/gov-claim-presentation"

export function useGovClaimListInfinite(params: GovClaimListQuery) {
  return useInfiniteQuery(
    infiniteListOptions(queryKeys.govClaims.list(params), params, (input) =>
      api.listGovClaims(input),
    ),
  )
}

export function useGovClaim(id: string | null) {
  return useQuery<GetGovClaimResponse>({
    queryKey: queryKeys.govClaims.detail(id ?? ""),
    queryFn: () => api.getGovClaim({ id: id as string }),
    enabled: !!id,
  })
}

function invalidateGovClaims(qc: QueryClient, id: string) {
  return invalidateKeys(qc, [queryKeys.govClaims.detail(id), queryKeys.govClaims.all])
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
    // Approval provisions a government role on the contact email's account, so the users caches go stale.
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

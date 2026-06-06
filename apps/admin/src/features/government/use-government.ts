"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  ApproveGovClaimRequest,
  GetGovClaimResponse,
  GovClaimListQuery,
  GovClaimListResponse,
  RejectGovClaimRequest,
  VerifyCheckRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

/**
 * Data hooks for the Government / gov-provisioning section (enumeration 2.H). This surface was a DEAD LINK
 * in the prototype (only GovRow + the .gov-claim-row CSS shipped); it is a first-class route here. Reads
 * use GET /admin/gov-claims (queue) and GET /admin/gov-claims/:id (detail: the three verification checks +
 * evidence). Writes use verify (toggle a check) / approve (provision gov_admin + link the jurisdiction) /
 * reject. Approving or rejecting a claim resolves it, so those mutations also invalidate the home +
 * activity aggregates; a verify toggle only touches the claim itself. Matches the scaffold's documented
 * pattern.
 *
 * Query keys: reuses the existing registry in src/lib/query.ts (gov.list/detail/all). No local keys were
 * needed.
 */

/** GET /admin/gov-claims - the gov-provisioning queue (filter by claim status + search via params). */
export function useGovClaimList(params: GovClaimListQuery) {
  return useQuery<GovClaimListResponse>({
    queryKey: queryKeys.gov.list(params),
    queryFn: () => api.listGovClaims(params),
  })
}

/** GET /admin/gov-claims/:id - full claim (identity, method, and the per-check verification map). */
export function useGovClaim(id: string | null) {
  return useQuery<GetGovClaimResponse>({
    queryKey: queryKeys.gov.detail(id ?? ""),
    queryFn: () => api.getGovClaim({ id: id as string }),
    enabled: !!id,
  })
}

/** POST /admin/gov-claims/:id/verify - mark one verification check verified/pending. */
export function useVerifyGovClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: VerifyCheckRequest) => api.verifyGovClaim(input),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.gov.detail(id) })
      qc.invalidateQueries({ queryKey: queryKeys.gov.all })
    },
  })
}

/** Invalidate every gov-claim view plus the home + activity aggregates after a resolving action. */
function invalidateGovResolved(qc: ReturnType<typeof useQueryClient>, id: string) {
  qc.invalidateQueries({ queryKey: queryKeys.gov.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.gov.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
  qc.invalidateQueries({ queryKey: queryKeys.activity.all })
}

/** POST /admin/gov-claims/:id/approve - provision gov_admin and link the jurisdiction. */
export function useApproveGovClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ApproveGovClaimRequest) => api.approveGovClaim(input),
    onSuccess: (_res, { id }) => invalidateGovResolved(qc, id),
  })
}

/** POST /admin/gov-claims/:id/reject - reject the claim (with a reason). */
export function useRejectGovClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RejectGovClaimRequest) => api.rejectGovClaim(input),
    onSuccess: (_res, { id }) => invalidateGovResolved(qc, id),
  })
}

"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminVerificationListQuery,
  AdminVerificationListResponse,
  ApproveVerificationRequest,
  GetAdminVerificationResponse,
  RejectVerificationRequest,
  VerificationDocumentUrlResponse,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

/**
 * Data hooks for the Verification queue (document "verified neighbor" review). Reads use GET
 * /admin/verifications (list), GET /admin/verifications/:userId (detail), and the per-document signed-URL
 * route GET /admin/verifications/:userId/documents/:mediaId/url. Writes are approve / reject. Every
 * mutation invalidates the verification caches plus the users + home + activity aggregates (a verify
 * decision flips the applicant's `verificationStatus` shown in the user section and moves the queue
 * counts), matching the pattern used by use-discovery / use-users.
 *
 * Query keys: reuses the registry in src/lib/query.ts (verification.list/detail/documentUrl +
 * verification.all + users.all).
 */

/** GET /admin/verifications - the verification queue (filter all/pending/verified/rejected + search). */
export function useVerifications(params: AdminVerificationListQuery) {
  return useQuery<AdminVerificationListResponse>({
    queryKey: queryKeys.verification.list(params),
    queryFn: () => api.listAdminVerifications(params),
  })
}

/** GET /admin/verifications/:userId - the full application (applicant, note, documents, decision). */
export function useVerification(userId: string | null) {
  return useQuery<GetAdminVerificationResponse>({
    queryKey: queryKeys.verification.detail(userId ?? ""),
    queryFn: () => api.getAdminVerification({ userId: userId as string }),
    enabled: !!userId,
  })
}

/**
 * GET /admin/verifications/:userId/documents/:mediaId/url - a short-lived signed URL for ONE uploaded
 * document image (verification media is never served by the public media path). The URL is cached
 * briefly; the document thumbnail renders it as an <img>.
 */
export function useVerificationDocumentUrl(userId: string | null, mediaId: string | null) {
  return useQuery<VerificationDocumentUrlResponse>({
    queryKey: queryKeys.verification.documentUrl(userId ?? "", mediaId ?? ""),
    queryFn: () =>
      api.adminVerificationDocumentUrl({ userId: userId as string, mediaId: mediaId as string }),
    enabled: !!userId && !!mediaId,
  })
}

/** Invalidate every verification view plus the users + home + activity aggregates after a write. */
function invalidateVerification(qc: ReturnType<typeof useQueryClient>, userId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.verification.detail(userId) })
  qc.invalidateQueries({ queryKey: queryKeys.verification.all })
  qc.invalidateQueries({ queryKey: queryKeys.users.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
  qc.invalidateQueries({ queryKey: queryKeys.activity.all })
}

/** POST /admin/verifications/:userId/approve - mark the applicant verified (no role change; audited). */
export function useApproveVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ApproveVerificationRequest) => api.approveVerification(input),
    onSuccess: (_res, { userId }) => invalidateVerification(qc, userId),
  })
}

/** POST /admin/verifications/:userId/reject - reject the application with a reason (audited). */
export function useRejectVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RejectVerificationRequest) => api.rejectVerification(input),
    onSuccess: (_res, { userId }) => invalidateVerification(qc, userId),
  })
}

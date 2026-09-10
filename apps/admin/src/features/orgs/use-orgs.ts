"use client"

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AdminAddOrgMemberRequest,
  AdminCreateOrgRequest,
  AdminGetMediaResponse,
  AdminOrgEventListResponse,
  AdminOrgEventWhen,
  AdminOrgListQuery,
  AdminOrgListResponse,
  AdminOrgMemberListResponse,
  AdminRemoveOrgMemberRequest,
  AdminSetOrgMemberRoleRequest,
  AdminSetOrgSuspendedRequest,
  AdminUpdateOrgRequest,
  ConfirmOrgCentralOrgRequest,
  DecideOrgVerificationRequest,
  EvaluateOrgEligibilityRequest,
  GetAdminOrgPaymentsResponse,
  GetAdminOrgResponse,
  SetOrgDonationsEnabledRequest,
  SetOrgEligibilityEinRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { queryKeys } from "@/lib/query"
import {
  EVIDENCE_URL_MAX_CACHE_MS,
  evidenceUrlLifetimeMs,
} from "@/features/orgs/evidence-cache"
import type { OrgProfileErrors } from "@/features/orgs/org-form"
import { uploadOrgLogo, type LogoFileFacts } from "@/features/orgs/org-logo-upload"
import { useUiStore } from "@/store/ui-store"

/** Every organization (adminListOrgs), keyset-paged; page one carries the chip `counts`. */
export function useOrgsInfinite(params: AdminOrgListQuery) {
  return useInfiniteQuery<AdminOrgListResponse>({
    queryKey: queryKeys.orgs.list(params),
    queryFn: ({ pageParam }) =>
      api.adminListOrgs({
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

export function useOrgMembersInfinite(id: string | null) {
  return useInfiniteQuery<AdminOrgMemberListResponse>({
    queryKey: queryKeys.orgs.members(id ?? ""),
    queryFn: ({ pageParam }) =>
      api.adminListOrgMembers({
        id: id as string,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!id,
  })
}

export function useOrgEventsInfinite(id: string | null, when: AdminOrgEventWhen) {
  return useInfiniteQuery<AdminOrgEventListResponse>({
    queryKey: queryKeys.orgs.events(id ?? "", { when }),
    queryFn: ({ pageParam }) =>
      api.adminListOrgEvents({
        id: id as string,
        when,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
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

type Qc = ReturnType<typeof useQueryClient>

function invalidateOrgLists(qc: Qc) {
  qc.invalidateQueries({ queryKey: queryKeys.orgs.all })
  qc.invalidateQueries({ queryKey: queryKeys.donations.all })
  qc.invalidateQueries({ queryKey: queryKeys.audit.all })
}

function invalidateOrg(qc: Qc, id: string) {
  qc.invalidateQueries({ queryKey: queryKeys.orgs.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.orgs.payments(id) })
  invalidateOrgLists(qc)
}

function invalidateOrgMembers(qc: Qc, id: string) {
  qc.invalidateQueries({ queryKey: queryKeys.orgs.members(id) })
  qc.invalidateQueries({ queryKey: queryKeys.orgs.detail(id) })
  qc.invalidateQueries({ queryKey: queryKeys.orgs.all })
  qc.invalidateQueries({ queryKey: queryKeys.users.all })
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

/**
 * Create/update render server field errors inline (slug conflict, VALIDATION.fields), so the hooks opt
 * out of the global error toast (a mutation-level onError replaces the QueryClient default). The form
 * maps the error to the fields it renders and calls this with what it could show: anything the form
 * has no field for — an unknown key, a CONFLICT on an unchanged slug, a rejected reason after the
 * prompt closed — still surfaces as the toast instead of vanishing.
 */
export function toastUnlessShownInline(err: unknown, shown: OrgProfileErrors) {
  if (Object.keys(shown).length > 0) return
  useUiStore.getState().showToast(errorMessage(err))
}

function quietOnError() {
  /* handled by the form: see toastUnlessShownInline */
}

export function useCreateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminCreateOrgRequest) => api.adminCreateOrg(input),
    onSuccess: (org) => {
      qc.setQueryData(queryKeys.orgs.detail(org.id), org)
      invalidateOrgLists(qc)
    },
    onError: quietOnError,
  })
}

export function useUploadOrgLogo() {
  return useMutation({
    mutationFn: (file: Blob & LogoFileFacts) => uploadOrgLogo({ api, file }),
    onError: quietOnError,
  })
}

export function useUpdateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminUpdateOrgRequest) => api.adminUpdateOrg(input),
    onSuccess: (org, { id }) => {
      qc.setQueryData(queryKeys.orgs.detail(id), org)
      invalidateOrg(qc, id)
    },
    onError: quietOnError,
  })
}

export function useSetOrgSuspended() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminSetOrgSuspendedRequest) => api.adminSetOrgSuspended(input),
    onSuccess: (org, { id }) => {
      qc.setQueryData(queryKeys.orgs.detail(id), org)
      invalidateOrg(qc, id)
    },
  })
}

export function useAddOrgMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminAddOrgMemberRequest) => api.adminAddOrgMember(input),
    onSuccess: (_res, { id }) => invalidateOrgMembers(qc, id),
  })
}

export function useSetOrgMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminSetOrgMemberRoleRequest) => api.adminSetOrgMemberRole(input),
    onSuccess: (_res, { id }) => invalidateOrgMembers(qc, id),
  })
}

export function useRemoveOrgMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminRemoveOrgMemberRequest) => api.adminRemoveOrgMember(input),
    onSuccess: (_res, { id }) => invalidateOrgMembers(qc, id),
  })
}

export function useSetOrgEligibilityEin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetOrgEligibilityEinRequest) => api.adminSetOrgEligibilityEin(input),
    onSuccess: (_res, { id }) => invalidateOrg(qc, id),
  })
}

export function useConfirmOrgCentralOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ConfirmOrgCentralOrgRequest) => api.adminConfirmOrgCentralOrg(input),
    onSuccess: (_res, { id }) => invalidateOrg(qc, id),
  })
}

export function useEvaluateOrgEligibility() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: EvaluateOrgEligibilityRequest) => api.adminEvaluateOrgEligibility(input),
    onSuccess: (_res, { id }) => invalidateOrg(qc, id),
  })
}

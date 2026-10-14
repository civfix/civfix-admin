"use client"

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query"
import type {
  AdminAddOrgMemberRequest,
  AdminCreateOrgRequest,
  AdminGetMediaResponse,
  AdminOrgEventWhen,
  AdminOrgListQuery,
  AdminRemoveOrgMemberRequest,
  AdminSetOrgMemberRoleRequest,
  AdminSetOrgSuspendedRequest,
  AdminUpdateOrgRequest,
  DecideOrgVerificationRequest,
  GetAdminOrgResponse,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { infiniteListOptions } from "@/lib/infinite"
import { invalidateKeys, queryKeys } from "@/lib/query"
import { EVIDENCE_URL_MAX_CACHE_MS, evidenceStaleTime } from "@/features/orgs/evidence-cache"
import {
  fieldErrorsFromError,
  updateFieldErrors,
  type OrgProfileErrors,
} from "@/features/orgs/org-form"
import { uploadOrgLogo, type LogoFileFacts } from "@/features/orgs/org-logo-upload"
import { ORG_ROLE_LABEL } from "@/features/orgs/org-members"
import { ORG_KIND_LABEL } from "@/features/orgs/org-verification"

/** Page one carries the chip `counts`. */
export function useOrgListInfinite(params: AdminOrgListQuery) {
  return useInfiniteQuery(
    infiniteListOptions(queryKeys.orgs.list(params), params, (input) => api.adminListOrgs(input)),
  )
}

export function useOrg(id: string | null) {
  return useQuery<GetAdminOrgResponse>({
    queryKey: queryKeys.orgs.detail(id ?? ""),
    queryFn: () => api.adminGetOrg({ id: id as string }),
    enabled: !!id,
  })
}

export function useOrgMemberListInfinite(id: string | null) {
  return useInfiniteQuery({
    ...infiniteListOptions(
      queryKeys.orgs.members(id ?? ""),
      { id: id as string },
      (input) => api.adminListOrgMembers(input),
    ),
    enabled: !!id,
  })
}

export function useOrgEventListInfinite(id: string | null, when: AdminOrgEventWhen) {
  return useInfiniteQuery({
    ...infiniteListOptions(
      queryKeys.orgs.events(id ?? "", { when }),
      { id: id as string, when },
      (input) => api.adminListOrgEvents(input),
    ),
    enabled: !!id,
  })
}

export function useOrgVerificationDocument(mediaId: string | null) {
  return useQuery<AdminGetMediaResponse>({
    queryKey: queryKeys.media.document(mediaId ?? ""),
    queryFn: () => api.adminGetMedia({ id: mediaId as string }),
    enabled: !!mediaId,
    staleTime: evidenceStaleTime,
    gcTime: EVIDENCE_URL_MAX_CACHE_MS,
  })
}

function invalidateOrg(qc: QueryClient, id?: string) {
  return invalidateKeys(qc, [
    id ? queryKeys.orgs.detail(id) : null,
    queryKeys.orgs.all,
    queryKeys.audit.all,
  ])
}

function storeOrgAndInvalidate(qc: QueryClient, id: string, org: GetAdminOrgResponse) {
  qc.setQueryData(queryKeys.orgs.detail(id), org)
  return invalidateOrg(qc, id)
}

function invalidateOrgMembers(qc: QueryClient, id: string) {
  return invalidateKeys(qc, [
    queryKeys.orgs.members(id),
    queryKeys.orgs.detail(id),
    queryKeys.orgs.all,
    queryKeys.users.all,
    queryKeys.audit.all,
  ])
}

export function useDecideOrgVerification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: DecideOrgVerificationRequest) => api.adminDecideOrgVerification(input),
    onSuccess: (_res, { id }) => invalidateOrg(qc, id),
    meta: {
      successMessage: (org: GetAdminOrgResponse, { decision, kind }: DecideOrgVerificationRequest) => {
        if (decision === "rejected") return `${org.name} rejected`
        return kind ? `${org.name} verified · ${ORG_KIND_LABEL[kind]}` : `${org.name} verified`
      },
    },
  })
}

/**
 * Create and update show the server's field errors inline (slug conflict, VALIDATION.fields), so the
 * global toast stays quiet for them; anything the form has no field for (an unknown key, a CONFLICT on
 * an unchanged slug, a rejected reason after the prompt closed) still surfaces as the error toast.
 */
function messageUnlessShownInline(inline: OrgProfileErrors, error: unknown): string | null {
  return Object.keys(inline).length > 0 ? null : errorMessage(error)
}

export function useCreateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminCreateOrgRequest) => api.adminCreateOrg(input),
    onSuccess: (org) => {
      qc.setQueryData(queryKeys.orgs.detail(org.id), org)
      return invalidateOrg(qc)
    },
    meta: {
      errorMessage: (error: unknown, request: AdminCreateOrgRequest) =>
        messageUnlessShownInline(fieldErrorsFromError(error, request), error),
      successMessage: (org: GetAdminOrgResponse) => `${org.name} created`,
    },
  })
}

export function useUploadOrgLogo() {
  return useMutation({
    mutationFn: (file: Blob & LogoFileFacts) => uploadOrgLogo({ api, file }),
    meta: { errorToast: false },
  })
}

export function useUpdateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminUpdateOrgRequest) => api.adminUpdateOrg(input),
    onSuccess: (org, { id }) => storeOrgAndInvalidate(qc, id, org),
    meta: {
      errorMessage: (error: unknown, request: AdminUpdateOrgRequest) =>
        messageUnlessShownInline(updateFieldErrors(error, request), error),
      successMessage: (org: GetAdminOrgResponse) => `${org.name} updated`,
    },
  })
}

export function useSetOrgSuspended() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminSetOrgSuspendedRequest) => api.adminSetOrgSuspended(input),
    onSuccess: (org, { id }) => storeOrgAndInvalidate(qc, id, org),
    meta: {
      successMessage: (org: GetAdminOrgResponse, { suspended }: AdminSetOrgSuspendedRequest) =>
        suspended ? `${org.name} suspended` : `${org.name} restored`,
    },
  })
}

/** A roster write plus the names its confirmation toast uses, which the request only carries as ids. */
export interface OrgMemberVariables<R> {
  request: R
  memberName: string
  orgName: string
}

export function useAddOrgMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ request }: OrgMemberVariables<AdminAddOrgMemberRequest>) => api.adminAddOrgMember(request),
    onSuccess: (_res, { request: { id } }) => invalidateOrgMembers(qc, id),
    meta: {
      successMessage: (
        _res: unknown,
        { request: { role }, memberName, orgName }: OrgMemberVariables<AdminAddOrgMemberRequest>,
      ) =>
        role === "owner"
          ? `${memberName} now owns ${orgName}`
          : `${memberName} added as ${ORG_ROLE_LABEL[role].toLowerCase()}`,
    },
  })
}

export function useSetOrgMemberRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ request }: OrgMemberVariables<AdminSetOrgMemberRoleRequest>) =>
      api.adminSetOrgMemberRole(request),
    onSuccess: (_res, { request: { id } }) => invalidateOrgMembers(qc, id),
    meta: {
      successMessage: (
        _res: unknown,
        { request: { role }, memberName, orgName }: OrgMemberVariables<AdminSetOrgMemberRoleRequest>,
      ) => (role === "owner" ? `${memberName} now owns ${orgName}` : `${memberName} · ${ORG_ROLE_LABEL[role]}`),
    },
  })
}

export function useRemoveOrgMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ request }: OrgMemberVariables<AdminRemoveOrgMemberRequest>) =>
      api.adminRemoveOrgMember(request),
    onSuccess: (_res, { request: { id } }) => invalidateOrgMembers(qc, id),
    meta: {
      successMessage: (_res: unknown, { memberName, orgName }: OrgMemberVariables<AdminRemoveOrgMemberRequest>) =>
        `${memberName} removed from ${orgName}`,
    },
  })
}

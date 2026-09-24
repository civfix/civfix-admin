"use client"

import {
  partialMatchKey,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import type {
  AddNoteRequest,
  DiscoveryListQuery,
  DiscoveryListResponse,
  FlagDiscoveryRequest,
  GetDiscoveryTaskResponse,
  JurisdictionDirectoryResponse,
  JurisdictionGeometryResponse,
  PatchJurisdictionRequest,
  SaveContactsRequest,
  SaveDraftRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { queryKeys } from "@/lib/query"
import { MINUTE_MS } from "@/lib/timing"
import { partialSaveMessage, type SavedExtras } from "@/features/discovery/discovery-payloads"
import type { DirectoryQuery } from "@/features/discovery/discovery-ui-state"

export function useDiscoveryList(params: DiscoveryListQuery) {
  return useQuery<DiscoveryListResponse>({
    queryKey: queryKeys.discovery.list(params),
    queryFn: () => api.listDiscovery(params),
  })
}

export function useDiscoveryTask(id: string | null) {
  return useQuery<GetDiscoveryTaskResponse>({
    queryKey: queryKeys.discovery.detail(id ?? ""),
    queryFn: () => api.getDiscoveryTask({ id: id as string }),
    enabled: !!id,
  })
}

/** The wire caps a page at 100; 50 keeps each scroll step quick. */
const DIRECTORY_PAGE_SIZE = 50

const GEOMETRY_STALE_MS = 5 * MINUTE_MS

/**
 * Search, filter and sort run in Postgres and the list pages by cursor, so the operator can reach all
 * ~28k jurisdictions, federal land included. `total` and `facets` ride on the first page only.
 */
export function useJurisdictionDirectory(params: DirectoryQuery) {
  return useInfiniteQuery<JurisdictionDirectoryResponse>({
    queryKey: queryKeys.jurisdictions.list(params),
    queryFn: ({ pageParam }) =>
      api.listJurisdictions({
        ...params,
        limit: DIRECTORY_PAGE_SIZE,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

/**
 * Not retried: a 404 means the jurisdiction has no stored boundary, and the detail panel falls back to
 * the text label on the query error.
 */
export function useJurisdictionGeometry(geoid: string | null) {
  return useQuery<JurisdictionGeometryResponse>({
    queryKey: queryKeys.jurisdictions.geometry(geoid ?? ""),
    queryFn: () => api.getJurisdictionGeometry({ geoid: geoid as string }),
    enabled: !!geoid,
    staleTime: GEOMETRY_STALE_MS,
    retry: false,
  })
}

const BOUNDARY_KEY = queryKeys.jurisdictions.geometry("").slice(0, -1)

/** The home aggregates count saved contacts and flags, so every discovery write refreshes them too. */
function invalidateDiscovery(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: queryKeys.discovery.all }),
    // No discovery write changes a boundary, and refetching the polygon would hold every save's
    // pending state on the largest payload in the section.
    qc.invalidateQueries({
      queryKey: queryKeys.jurisdictions.all,
      predicate: (query) => !partialMatchKey(query.queryKey, BOUNDARY_KEY),
    }),
    qc.invalidateQueries({ queryKey: queryKeys.home.all }),
  ])
}

export function useAddDiscoveryNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AddNoteRequest) => api.addDiscoveryNote(input),
    onSuccess: (_res, { id }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.discovery.detail(id) }),
        invalidateDiscovery(qc),
      ]),
  })
}

export function useFlagDiscovery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FlagDiscoveryRequest) => api.flagDiscovery(input),
    onSuccess: (_res, { id }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.discovery.detail(id) }),
        invalidateDiscovery(qc),
      ]),
  })
}

export function useSaveDiscoveryDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveDraftRequest) => api.saveDiscoveryDraft(input),
    onSuccess: (_res, { id }) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.discovery.detail(id) }),
        invalidateDiscovery(qc),
      ]),
  })
}

export interface SaveContactsVariables {
  request: SaveContactsRequest
  /** The jurisdiction's name, for the success toast. */
  org: string
  /** The note / @handle a PATCH already saved just before this request, which a failure must mention. */
  savedFirst?: SavedExtras
}

export function useSaveJurisdictionContacts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ request }: SaveContactsVariables) => api.saveJurisdictionContacts(request),
    onSuccess: () => invalidateDiscovery(qc),
    meta: {
      errorMessage: (error: unknown, { savedFirst }: SaveContactsVariables) =>
        savedFirst ? partialSaveMessage(savedFirst, errorMessage(error)) : errorMessage(error),
      successMessage: (_res: unknown, { org }: SaveContactsVariables) =>
        `Contacts saved for ${org} · discovery task closed`,
    },
  })
}

export interface PatchJurisdictionVariables {
  request: PatchJurisdictionRequest
  /** The jurisdiction's name, for the success toast. */
  org: string
  /**
   * What the operator saved, which picks the toast. "extras" is the note / @handle saved just before
   * Save & route, which leaves the toast to that save.
   */
  action: "flag" | "draft" | "template" | "extras"
}

function patchSuccessMessage({ request, org, action }: PatchJurisdictionVariables): string | null {
  switch (action) {
    case "flag":
      return request.flagged ? `${org} flagged for review` : `Flag cleared for ${org}`
    case "draft":
      return `Draft saved for ${org}`
    case "template":
      return `Email template saved for ${org}`
    case "extras":
      return null
  }
}

export function usePatchJurisdiction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ request }: PatchJurisdictionVariables) => api.patchJurisdiction(request),
    onSuccess: () => invalidateDiscovery(qc),
    meta: {
      successMessage: (_res: unknown, variables: PatchJurisdictionVariables) =>
        patchSuccessMessage(variables),
    },
  })
}

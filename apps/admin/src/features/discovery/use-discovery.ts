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
  JurisdictionListQuery,
  PatchJurisdictionRequest,
  SaveContactsRequest,
  SaveDraftRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { queryKeys } from "@/lib/query"
import { partialSaveMessage, type SavedExtras } from "@/features/discovery/discovery-payloads"

/**
 * Data hooks for the Discovery / Jurisdictions section (enumeration 2.B). Reads use GET /admin/discovery
 * (list) and GET /admin/discovery/:id (detail); writes use the discovery + jurisdictions mutations. All
 * mutations invalidate the discovery + jurisdictions caches plus the cross-cutting home summary
 * (a saved contact / flag changes the dashboard aggregates), matching the scaffold's documented pattern.
 *
 * Query keys: reuses the existing registry in src/lib/query.ts (discovery.list/detail/all,
 * jurisdictions.all). No local keys were needed.
 */

/** GET /admin/discovery - the population-sorted discovery queue (filter/sort/search via params). */
export function useDiscoveryList(params: DiscoveryListQuery) {
  return useQuery<DiscoveryListResponse>({
    queryKey: queryKeys.discovery.list(params),
    queryFn: () => api.listDiscovery(params),
  })
}

/** GET /admin/discovery/:id - full task (notes, per-category counts, existing contacts, geometry). */
export function useDiscoveryTask(id: string | null) {
  return useQuery<GetDiscoveryTaskResponse>({
    queryKey: queryKeys.discovery.detail(id ?? ""),
    queryFn: () => api.getDiscoveryTask({ id: id as string }),
    enabled: !!id,
  })
}

/** The server-driven directory query: search (`q`) + routing-posture `filter` + type `layer` + `sort`. `cursor`/`limit` are paged internally. */
export type JurisdictionDirectoryParams = Pick<JurisdictionListQuery, "q" | "filter" | "layer" | "sort">

/** Page size for the directory infinite scroll (the wire caps at 100; 50 keeps each page snappy). */
const DIRECTORY_PAGE_SIZE = 50

/**
 * GET /admin/jurisdictions - the full jurisdiction directory: EVERY jurisdiction reports map to (incl.
 * federal land), with its type, routing posture, waiting-report counts, and existing contacts.
 *
 * Server-driven: search/filter/sort happen in Postgres and the page scrolls via `nextCursor`, so the
 * operator can reach ALL ~28k jurisdictions (the prior client-only `limit:100` showed only the first
 * page, alphabetically Alabama). `total` + `facets` ride along on the first page for the header + chips.
 */
export function useJurisdictionDirectory(params: JurisdictionDirectoryParams) {
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
 * GET /admin/jurisdictions/:geoid/geometry - one jurisdiction's simplified boundary (GeoJSON + bbox +
 * interior point) for the directory's verification map. Disabled for the synthetic "Unmapped" row and
 * until a real geoid is selected. A 404 (no stored boundary) surfaces as the query error, and the detail
 * panel falls back to the text label.
 */
export function useJurisdictionGeometry(geoid: string | null) {
  return useQuery<JurisdictionGeometryResponse>({
    queryKey: queryKeys.jurisdictions.geometry(geoid ?? ""),
    queryFn: () => api.getJurisdictionGeometry({ geoid: geoid as string }),
    enabled: !!geoid,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

const BOUNDARY_KEY = queryKeys.jurisdictions.geometry("").slice(0, -1)

/** Invalidate every discovery/jurisdiction view plus the home aggregates after a write. */
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

/** POST /admin/discovery/:id/notes - append an operator note to a discovery task. */
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

/** POST /admin/discovery/:id/flag - flag a discovery task / jurisdiction for review. */
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

/** POST /admin/discovery/:id/draft - save the routing-contact draft without routing. */
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

/** POST /admin/jurisdictions/:geoid/contacts - the core "Save contacts" action. */
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

/**
 * PATCH /admin/jurisdictions/:geoid - non-routing edits on a directory jurisdiction: save a contact
 * draft (contacts/form without routing the pending pins) and flag / unflag for review (flagged +
 * flagReason). Used by the Directory detail's "Save draft" and "Flag for review" actions.
 */
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

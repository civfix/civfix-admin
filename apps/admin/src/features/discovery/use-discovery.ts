"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AddNoteRequest,
  DiscoveryListQuery,
  DiscoveryListResponse,
  FlagDiscoveryRequest,
  GetDiscoveryTaskResponse,
  JurisdictionDirectoryResponse,
  JurisdictionListQuery,
  PatchJurisdictionRequest,
  SaveContactsRequest,
  SaveDraftRequest,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

/**
 * Data hooks for the Discovery / Jurisdictions section (enumeration 2.B). Reads use GET /admin/discovery
 * (list) and GET /admin/discovery/:id (detail); writes use the discovery + jurisdictions mutations. All
 * mutations invalidate the discovery + jurisdictions caches plus the cross-cutting home + activity feeds
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

/**
 * GET /admin/jurisdictions - the full jurisdiction directory: EVERY jurisdiction reports map to (incl.
 * federal land), with its type, routing posture, waiting-report counts, and existing contacts. This is
 * the persistent list the Jurisdictions page is sourced from (routed jurisdictions stay listed, unlike
 * the discovery-task queue which drops them once routed).
 */
export function useJurisdictionDirectory(params: JurisdictionListQuery) {
  return useQuery<JurisdictionDirectoryResponse>({
    queryKey: queryKeys.jurisdictions.list(params),
    queryFn: () => api.listJurisdictions(params),
  })
}

/** Invalidate every discovery/jurisdiction view plus the home + activity aggregates after a write. */
function invalidateDiscovery(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.discovery.all })
  qc.invalidateQueries({ queryKey: queryKeys.jurisdictions.all })
  qc.invalidateQueries({ queryKey: queryKeys.home.all })
  qc.invalidateQueries({ queryKey: queryKeys.activity.all })
}

/** POST /admin/discovery/:id/notes - append an operator note to a discovery task. */
export function useAddDiscoveryNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AddNoteRequest) => api.addDiscoveryNote(input),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.discovery.detail(id) })
      invalidateDiscovery(qc)
    },
  })
}

/** POST /admin/discovery/:id/flag - flag a discovery task / jurisdiction for review. */
export function useFlagDiscovery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: FlagDiscoveryRequest) => api.flagDiscovery(input),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.discovery.detail(id) })
      invalidateDiscovery(qc)
    },
  })
}

/** POST /admin/discovery/:id/draft - save the routing-contact draft without routing. */
export function useSaveDiscoveryDraft() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveDraftRequest) => api.saveDiscoveryDraft(input),
    onSuccess: (_res, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.discovery.detail(id) })
      invalidateDiscovery(qc)
    },
  })
}

/** POST /admin/jurisdictions/:geoid/contacts - the core "Save & route" action. */
export function useSaveJurisdictionContacts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveContactsRequest) => api.saveJurisdictionContacts(input),
    onSuccess: () => invalidateDiscovery(qc),
  })
}

/**
 * PATCH /admin/jurisdictions/:geoid - non-routing edits on a directory jurisdiction: save a contact
 * draft (contacts/form without routing the pending pins) and flag / unflag for review (flagged +
 * flagReason). Used by the Directory detail's "Save draft" and "Flag for review" actions.
 */
export function usePatchJurisdiction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PatchJurisdictionRequest) => api.patchJurisdiction(input),
    onSuccess: () => invalidateDiscovery(qc),
  })
}

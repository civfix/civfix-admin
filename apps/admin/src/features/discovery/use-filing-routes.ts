"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  ListFilingRoutesResponse,
  SaveFilingRoutesRequest,
  SaveFilingRoutesResponse,
} from "@civfix/contract"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

export function useFilingRoutes(geoid: string) {
  return useQuery<ListFilingRoutesResponse>({
    queryKey: queryKeys.jurisdictions.filingRoutes(geoid),
    queryFn: () => api.listFilingRoutes({ geoid }),
  })
}

export function useSaveFilingRoutes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveFilingRoutesRequest) => api.saveFilingRoutes(input),
    // The response is the jurisdiction's whole saved set, so it replaces the cached list outright.
    onSuccess: (res: SaveFilingRoutesResponse, { geoid }) =>
      qc.setQueryData<ListFilingRoutesResponse>(queryKeys.jurisdictions.filingRoutes(geoid), res),
    meta: {
      // Every refusal shows in the card, on its row or above Save routes.
      errorToast: false,
      successMessage: () => "Routes saved",
    },
  })
}

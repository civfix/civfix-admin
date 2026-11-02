"use client"

import { useQuery } from "@tanstack/react-query"
import type { GetLegalVersionsResponse } from "@civfix/contract"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

export function useLegalVersions() {
  return useQuery<GetLegalVersionsResponse>({
    queryKey: queryKeys.legal.versions,
    queryFn: () => api.adminGetLegalVersions(),
  })
}

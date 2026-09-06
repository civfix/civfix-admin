"use client"

import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type {
  AdminDonationListQuery,
  AdminDonationListResponse,
  AdminDonationTotalsByOrgQuery,
  AdminDonationTotalsByOrgResponse,
  AdminPaymentsEligibilityListQuery,
  AdminPaymentsEligibilityListResponse,
  GetAdminPlatformDonationSettingsResponse,
  GetLegalVersionsResponse,
} from "@civfix/shared"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

export function useAdminDonationsInfinite(params: AdminDonationListQuery) {
  return useInfiniteQuery<AdminDonationListResponse>({
    queryKey: queryKeys.donations.list(params),
    queryFn: ({ pageParam }) =>
      api.adminListDonations({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useDonationTotalsByOrg(params: AdminDonationTotalsByOrgQuery) {
  return useQuery<AdminDonationTotalsByOrgResponse>({
    queryKey: queryKeys.donations.totalsByOrg(params),
    queryFn: () => api.adminDonationTotalsByOrg(params),
  })
}

export function usePaymentsEligibilityInfinite(params: AdminPaymentsEligibilityListQuery) {
  return useInfiniteQuery<AdminPaymentsEligibilityListResponse>({
    queryKey: queryKeys.donations.eligibility(params),
    queryFn: ({ pageParam }) =>
      api.adminListPaymentsEligibility({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function usePlatformDonationSettings() {
  return useQuery<GetAdminPlatformDonationSettingsResponse>({
    queryKey: queryKeys.donations.settings,
    queryFn: () => api.adminGetPlatformDonationSettings(),
    staleTime: 5 * 60_000,
  })
}

export function useLegalVersions() {
  return useQuery<GetLegalVersionsResponse>({
    queryKey: queryKeys.donations.legal,
    queryFn: () => api.adminGetLegalVersions(),
    staleTime: 5 * 60_000,
  })
}

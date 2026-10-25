"use client"

import { hashKey, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import type { AdminFilingDTO, AdminReportDTO, FilingStatus, GetFilingResponse } from "@civfix/contract"

import { api } from "@/lib/api"
import { invalidateKeys, queryKeys } from "@/lib/query"
import { SECOND_MS } from "@/lib/timing"

export type ReportFiling = NonNullable<AdminReportDTO["filing"]>

const FILING_POLL_MS = 5 * SECOND_MS

function isFilingActive(status: FilingStatus): boolean {
  return status === "queued" || status === "running"
}

// The poll that saw the filing settle already holds its fresh row, and refetching that query from
// inside its own fetch would cancel the fetch, so every other filing query refreshes but this one.
function refreshAfterSettle(qc: QueryClient, filing: AdminFilingDTO) {
  const ownHash = hashKey(queryKeys.filings.detail(filing.id))
  return invalidateKeys(qc, [
    queryKeys.reports.detail(filing.reportId),
    { queryKey: queryKeys.filings.all, predicate: (query) => query.queryHash !== ownHash },
    queryKeys.home.all,
  ])
}

/**
 * The report's filing with its evidence, shown from the report's own copy until it loads. Evidence URLs
 * expire after 15 minutes, so it is refetched on every mount, and polled while the filing is queued or
 * running.
 */
export function useFiling(filing: ReportFiling | null) {
  const qc = useQueryClient()
  const id = filing?.id ?? ""
  return useQuery<GetFilingResponse>({
    queryKey: queryKeys.filings.detail(id),
    queryFn: async () => {
      const before =
        qc.getQueryData<GetFilingResponse>(queryKeys.filings.detail(id))?.filing.status ?? filing?.status
      const res = await api.getFiling({ id })
      if (before && isFilingActive(before) && !isFilingActive(res.filing.status)) {
        void refreshAfterSettle(qc, res.filing)
      }
      return res
    },
    enabled: filing !== null,
    staleTime: 0,
    placeholderData: filing ? { filing: { ...filing, evidence: [] } } : undefined,
    refetchInterval: (query) => {
      const status = query.state.data?.filing.status
      return status && isFilingActive(status) ? FILING_POLL_MS : false
    },
  })
}

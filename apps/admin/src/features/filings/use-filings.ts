"use client"

import * as React from "react"
import { hashKey, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import type {
  AdminFilingDTO,
  AdminReportDTO,
  CancelFilingRequest,
  FileReportRequest,
  FilingStatus,
  GetFilingResponse,
  RecordManualFilingRequest,
  RetryFilingRequest,
} from "@civfix/contract"

import { api } from "@/lib/api"
import { invalidateKeys, queryKeys } from "@/lib/query"
import { SECOND_MS } from "@/lib/timing"

export type ReportFiling = NonNullable<AdminReportDTO["filing"]>

const FILING_POLL_MS = 5 * SECOND_MS

function isFilingActive(status: FilingStatus): boolean {
  return status === "queued" || status === "running"
}

function invalidateFiling(qc: QueryClient, reportId: string) {
  return invalidateKeys(qc, [
    queryKeys.reports.detail(reportId),
    queryKeys.filings.all,
    queryKeys.home.all,
  ])
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

// Each response is the filing as it now is: writing it into the detail cache before the refetch lets
// that refetch compare against the new status, so a filing this mutation settled is not taken for
// one a poll settled.
function useFilingMutation<I>(
  mutationFn: (input: I) => Promise<{ filing: AdminFilingDTO }>,
  meta: { successMessage: () => string; errorToast?: false },
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: ({ filing }) => {
      qc.setQueryData<GetFilingResponse>(queryKeys.filings.detail(filing.id), (old) => ({
        filing: { ...filing, evidence: old?.filing.evidence ?? [] },
      }))
      return invalidateFiling(qc, filing.reportId)
    },
    meta,
  })
}

export interface ManualDraft {
  caseId: string
  caseUrl: string
  note: string
}

const EMPTY_MANUAL_DRAFT: ManualDraft = { caseId: "", caseUrl: "", note: "" }

export function useFilingControls() {
  // The card's inline forms show these errors themselves.
  const file = useFilingMutation((input: FileReportRequest) => api.fileReport(input), {
    successMessage: () => "Filing created",
    errorToast: false,
  })
  const retry = useFilingMutation((input: RetryFilingRequest) => api.retryFiling(input), {
    successMessage: () => "Filing queued again",
  })
  const cancel = useFilingMutation((input: CancelFilingRequest) => api.cancelFiling(input), {
    successMessage: () => "Filing cancelled",
  })
  const manual = useFilingMutation(
    (input: RecordManualFilingRequest) => api.recordManualFiling(input),
    { successMessage: () => "Manual filing recorded", errorToast: false },
  )
  const [form, setForm] = React.useState<"file" | "manual" | null>(null)
  const [fileNote, setFileNote] = React.useState("")
  const [manualDraft, setManualDraft] = React.useState(EMPTY_MANUAL_DRAFT)
  return {
    file,
    retry,
    cancel,
    manual,
    form,
    setForm,
    fileNote,
    setFileNote,
    manualDraft,
    setManualDraft,
    busy: file.isPending || retry.isPending || cancel.isPending || manual.isPending,
  }
}

export type FilingControls = ReturnType<typeof useFilingControls>

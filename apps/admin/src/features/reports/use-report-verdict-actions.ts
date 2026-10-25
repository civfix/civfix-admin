"use client"

import type { AdminReportDTO } from "@civfix/contract"

import { confirmDialog } from "@/components/shared/dialog"
import { filingRouteLine } from "@/features/filings/filing-labels"
import type { ReportFiling } from "@/features/filings/use-filings"
import { useSetReportVerdict } from "@/features/reports/use-reports"

function sentences(parts: (string | null)[]): string {
  return parts.filter((part): part is string => part !== null).join(" ")
}

function approveBody(routeLine: string | null): string {
  return sentences([
    "This approves this report's verification and files it with the city.",
    routeLine ? `Route: ${routeLine}.` : null,
    "Once this reporter has two approved reports, their account is marked report-verified.",
  ])
}

// Reject cancels a queued or needs-human filing (D1); a running one finishes, and the city may have it.
function rejectBody(report: AdminReportDTO, filing: ReportFiling | null): string {
  const status = filing?.status
  const filed = report.outreach.routedAt !== null || status === "submitted" || status === "linked_existing"
  const cancels = status === "queued" || status === "needs_human"
  return sentences([
    "This rejects the report's verification verdict.",
    filed
      ? "It was already filed with the city, and rejecting does not withdraw it."
      : status === undefined || status === "cancelled"
        ? "It is not sent to the city."
        : null,
    cancels ? "This also cancels its city filing." : null,
  ])
}

export function useReportVerdictControls() {
  const verdictMutation = useSetReportVerdict()
  return { verdictMutation }
}

export type ReportVerdictControls = ReturnType<typeof useReportVerdictControls>

export function reportVerdictActions(
  controls: ReportVerdictControls,
  report: AdminReportDTO,
  filing: ReportFiling | null,
  onApprovedChange: (approved: boolean) => void,
) {
  const { verdictMutation } = controls

  const approve = async () => {
    if (verdictMutation.isPending) return
    const ok = await confirmDialog({
      title: "Approve and file?",
      body: approveBody(filingRouteLine(report.filingRoute)),
      confirmLabel: "Approve and file",
    })
    if (!ok) return
    verdictMutation.mutate(
      { id: report.id, verdict: "approved" },
      { onSuccess: () => onApprovedChange(true) },
    )
  }

  const reject = async () => {
    const ok = await confirmDialog({
      title: "Reject report",
      body: rejectBody(report, filing),
      danger: true,
      confirmLabel: "Reject",
    })
    if (!ok) return
    verdictMutation.mutate(
      { id: report.id, verdict: "rejected" },
      { onSuccess: () => onApprovedChange(false) },
    )
  }

  return { approve, reject, verdictPending: verdictMutation.isPending }
}

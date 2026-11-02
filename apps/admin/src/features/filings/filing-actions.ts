import type { ReportFiling } from "@/features/filings/use-filings"

interface FilingActionSet {
  file: boolean
  fileAgain: boolean
  retry: boolean
  cancel: boolean
  recordManual: boolean
  copyText: boolean
}

/**
 * The actions D5 allows on the report's latest filing. A running filing offers none that change it:
 * the server answers CONFLICT until its run ends. A filing the city asked more of keeps its request,
 * so it can only be answered by hand and recorded.
 */
export function filingActions(
  filing: ReportFiling | null,
  report: { verdictApproved: boolean; fileable: boolean },
): FilingActionSet {
  if (!filing) {
    return {
      file: report.verdictApproved,
      fileAgain: false,
      retry: false,
      cancel: false,
      recordManual: false,
      copyText: false,
    }
  }
  const open = filing.status === "queued" || filing.status === "needs_human"
  const cityAsked = filing.reason === "city_needs_info"
  return {
    file: false,
    // A rejected report is not fileable, so the server would refuse it; it offers Approve and file.
    fileAgain: report.fileable && (filing.status === "cancelled" || filing.cityClosedAt !== null),
    retry: filing.status === "needs_human" && !cityAsked,
    cancel: open && !cityAsked,
    recordManual: open,
    copyText: true,
  }
}

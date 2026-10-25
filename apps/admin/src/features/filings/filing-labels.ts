import type {
  AdminReportFilingRoute,
  FilingChannel,
  FilingReason,
  FilingStatus,
} from "@civfix/contract"

export const FILING_REASON_LABEL = {} as Record<FilingReason, string>

export const FILING_STATUS_LABEL = {} as Record<FilingStatus, string>

export const FILING_CHANNEL_LABEL = {} as Record<FilingChannel, string>

export function filingRouteLine(_route: AdminReportFilingRoute | null | undefined): string | null {
  throw new Error("not implemented")
}

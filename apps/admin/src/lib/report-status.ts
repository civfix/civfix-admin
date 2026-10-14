import { Icons, type IconComponent } from "@/components/icons"
import type { AdminReportStatus } from "@civfix/shared"

/**
 * The one status-to-bucket map every admin surface reads, so pill labels never disagree. A report is
 * created `published`: live but still awaiting a city contact, so it (and `held`) belongs in
 * `submitted`, and only `resolved` is Completed. Mirrors STATUS_BUCKETS in the backend's
 * admin-report-status.ts; keep the two in sync.
 */

type ReportBucket = "submitted" | "in_progress" | "completed" | "removed"

const REPORT_STATUS_BUCKET: Record<AdminReportStatus, ReportBucket> = {
  submitted: "submitted",
  held: "submitted",
  published: "submitted",
  acknowledged: "in_progress",
  in_progress: "in_progress",
  resolved: "completed",
  rejected: "removed",
}

export interface ReportStatusView {
  cls: string
  icon: IconComponent
  label: string
  /** Text color for the status named inline, outside a pill. */
  tone: string
}

const BUCKET_VIEW: Record<ReportBucket, ReportStatusView> = {
  submitted: { cls: "status-new", icon: Icons.Inbox, label: "Needs verification", tone: "var(--ink-2)" },
  in_progress: {
    cls: "status-progress",
    icon: Icons.Clock,
    label: "In progress",
    tone: "var(--lilac-600)",
  },
  completed: { cls: "status-ok", icon: Icons.Check, label: "Completed", tone: "var(--moss-700)" },
  removed: { cls: "status-flag", icon: Icons.Trash, label: "Removed", tone: "var(--bloom-700)" },
}

export function isReportStatus(status: string): status is AdminReportStatus {
  return Object.hasOwn(REPORT_STATUS_BUCKET, status)
}

// A status from a newer server reads as awaiting action rather than crashing or passing as Completed.
export function reportBucket(status: string): ReportBucket {
  return isReportStatus(status) ? REPORT_STATUS_BUCKET[status] : "submitted"
}

export function reportNeedsAttention(status: string, flagged: boolean): boolean {
  return flagged || (isReportStatus(status) && REPORT_STATUS_BUCKET[status] === "submitted")
}

// Takes any string because the home map's pin status also spans event statuses.
export function reportStatusView(status: string): ReportStatusView {
  return BUCKET_VIEW[reportBucket(status)]
}

import { Icons, type IconComponent } from "@/components/icons"
import type { AdminReportStatus } from "@civfix/shared"

/**
 * The one status-to-bucket map every admin surface reads, so pill labels never disagree. A report is
 * created `published`: live but still awaiting a city contact, so it (and `held`) belongs in
 * `submitted`, and only `resolved` is Completed. Mirrors STATUS_BUCKETS in the backend's
 * admin-report-service.ts; keep the two in sync.
 */

export type ReportBucket = "submitted" | "in_progress" | "completed" | "removed"

export const REPORT_STATUS_BUCKET: Record<AdminReportStatus, ReportBucket> = {
  submitted: "submitted",
  held: "submitted",
  published: "submitted",
  acknowledged: "in_progress",
  in_progress: "in_progress",
  resolved: "completed",
  rejected: "removed",
}

export const BUCKET_VIEW: Record<
  ReportBucket,
  { cls: string; icon: IconComponent; label: string }
> = {
  submitted: { cls: "status-new", icon: Icons.Inbox, label: "Needs verification" },
  in_progress: { cls: "status-progress", icon: Icons.Clock, label: "In progress" },
  completed: { cls: "status-ok", icon: Icons.Check, label: "Completed" },
  removed: { cls: "status-flag", icon: Icons.Trash, label: "Removed" },
}

export function reportBucket(status: AdminReportStatus): ReportBucket {
  // A status from a newer server reads as awaiting action rather than crashing or passing as Completed.
  return REPORT_STATUS_BUCKET[status] ?? "submitted"
}

export function isReportStatus(status: string): status is AdminReportStatus {
  return Object.hasOwn(REPORT_STATUS_BUCKET, status)
}

export function reportBucketOf(status: string): ReportBucket {
  return isReportStatus(status) ? reportBucket(status) : "submitted"
}

export function reportNeedsAttention(status: string, flagged: boolean): boolean {
  return flagged || (isReportStatus(status) && reportBucket(status) === "submitted")
}

export function reportStatusView(status: AdminReportStatus): {
  cls: string
  icon: IconComponent
  label: string
} {
  return BUCKET_VIEW[reportBucket(status)]
}

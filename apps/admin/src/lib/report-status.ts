import { Icons, type IconComponent } from "@/components/icons"
import type { AdminReportStatus } from "@civfix/shared"

/**
 * Canonical report-status -> design-bucket reconciliation for the admin. This is the SINGLE source the
 * reports list, the reports detail, the users Reports tab, the home reports tile, and the live map all read
 * from, so the pill labels never disagree (they previously did — five hand-written maps that drifted).
 *
 * The civfix lifecycle is submitted -> held -> published -> acknowledged -> in_progress -> resolved
 * (+ rejected). The design surface has only three live buckets (Submitted | In progress | Completed) plus
 * the orthogonal Removed. CRUCIAL: an authed pin is created `published` — LIVE, visible, AWAITING a city
 * contact — so published (and held, "under review") belong in SUBMITTED, NOT Completed. Only `resolved` is
 * Completed. This mirrors STATUS_BUCKETS in the backend (admin-report-service.ts); keep the two in sync.
 */

/** A design status bucket: the three live buckets + the orthogonal Removed. */
export type ReportBucket = "submitted" | "in_progress" | "completed" | "removed"

/** Map every civfix status to its design bucket. */
export const REPORT_STATUS_BUCKET: Record<AdminReportStatus, ReportBucket> = {
  submitted: "submitted",
  held: "submitted",
  published: "submitted",
  acknowledged: "in_progress",
  in_progress: "in_progress",
  resolved: "completed",
  rejected: "removed",
}

/** Pill treatment per design bucket: CSS pill class + leading icon + label. */
export const BUCKET_VIEW: Record<
  ReportBucket,
  { cls: string; icon: IconComponent; label: string }
> = {
  submitted: { cls: "status-new", icon: Icons.Inbox, label: "Submitted" },
  in_progress: { cls: "status-progress", icon: Icons.Clock, label: "In progress" },
  completed: { cls: "status-ok", icon: Icons.Check, label: "Completed" },
  removed: { cls: "status-flag", icon: Icons.Trash, label: "Removed" },
}

/** The design bucket a civfix status falls in (for filter counts + the quick-status active state). */
export function reportBucket(status: AdminReportStatus): ReportBucket {
  // Fallback to "submitted" for any unknown/new status so a future enum value reads as new (awaiting
  // action) rather than crashing or silently dropping into Completed.
  return REPORT_STATUS_BUCKET[status] ?? "submitted"
}

/** The pill treatment (class + icon + label) for any civfix status, via its design bucket. */
export function reportStatusView(status: AdminReportStatus): {
  cls: string
  icon: IconComponent
  label: string
} {
  return BUCKET_VIEW[reportBucket(status)]
}

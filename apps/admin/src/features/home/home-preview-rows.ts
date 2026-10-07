import {
  MODERATION_KIND_LABELS,
  relativeAgo,
  type AdminEventListItemDTO,
  type AdminReportListItemDTO,
  type AdminUserListItemDTO,
  type DiscoveryTaskDTO,
  type InboundEmailListItemDTO,
  type MailDirection,
  type MailThreadListItemDTO,
  type ModerationListItemDTO,
  type ReportCategory,
} from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import type { Hue } from "@/features/analytics/analytics-charts"
import { inboxFocusId } from "@/features/mail/mail-page-state"
import { formatCompactCount } from "@/lib/display"
import { EMPTY_VALUE } from "@/lib/empty-value"
import { reportStatusView } from "@/lib/report-status"

export interface PeekItem {
  kind: "pin" | "icon" | "dir" | "avatar"
  cat?: ReportCategory
  icon?: IconComponent
  hue?: Hue
  dir?: MailDirection
  name?: string
  title: string
  meta: string
  age: string
  focusId: string
}

export function discoveryRow(task: DiscoveryTaskDTO): PeekItem {
  const population = task.pop > 0 ? formatCompactCount(task.pop) : ""
  return {
    kind: "pin",
    cat: task.category,
    title: task.place,
    meta: population ? `${task.reports} reports · pop ${population}` : `${task.reports} reports`,
    age: task.age,
    focusId: task.geoid,
  }
}

export function reportRow(report: AdminReportListItemDTO): PeekItem {
  return {
    kind: "pin",
    cat: report.category,
    title: report.title,
    meta: `${report.place} · ${reportStatusView(report.status).label}`,
    age: report.submitted.rel,
    focusId: report.id,
  }
}

export function eventRow(event: AdminEventListItemDTO): PeekItem {
  return {
    kind: "icon",
    icon: Icons.Calendar,
    hue: "sun",
    title: event.title,
    meta: `${event.place} · ${event.attendees} attending`,
    age: event.date.rel,
    focusId: event.id,
  }
}

function mailRow(thread: MailThreadListItemDTO): PeekItem {
  return {
    kind: "dir",
    dir: thread.dir,
    title: thread.org,
    meta: thread.subject,
    age: relativeAgo(thread.ts),
    focusId: thread.id,
  }
}

function inboxRow(email: InboundEmailListItemDTO): PeekItem {
  return {
    kind: "icon",
    icon: Icons.Inbox,
    hue: "sky",
    title: email.from || email.recipient,
    meta: email.subject || "(no subject)",
    age: relativeAgo(email.ts),
    focusId: inboxFocusId(email.id),
  }
}

export function mailPreviewRows(
  outreach: readonly MailThreadListItemDTO[],
  inbound: readonly InboundEmailListItemDTO[],
  limit: number,
): PeekItem[] {
  // Both feeds serialize ts with toISOString, so comparing the strings orders them by time.
  const newestFirst = (a: { ts: string }, b: { ts: string }) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0)
  return [
    ...outreach.map((thread) => ({ ts: thread.ts, row: mailRow(thread) })),
    ...inbound.map((email) => ({ ts: email.ts, row: inboxRow(email) })),
  ]
    .sort(newestFirst)
    .slice(0, limit)
    .map((entry) => entry.row)
}

export function userRow(user: AdminUserListItemDTO): PeekItem {
  return {
    kind: "avatar",
    name: user.name,
    title: user.name,
    meta: user.flagReason ?? (user.city || EMPTY_VALUE),
    age: user.lastActive,
    focusId: user.id,
  }
}

export function moderationRow(item: ModerationListItemDTO): PeekItem {
  const title =
    item.kind === "user_report" && item.subjectType
      ? `Reported ${item.subjectType}`
      : MODERATION_KIND_LABELS[item.kind]
  return {
    kind: "icon",
    icon: Icons.Flag,
    hue: "lilac",
    title,
    meta: `${item.reason} · ${item.reporter}`,
    age: item.age,
    focusId: item.id,
  }
}

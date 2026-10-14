import {
  MODERATION_KIND_LABELS,
  type ModerationKind,
  type ModerationListItemDTO,
  type ModerationTone,
  type Priority,
} from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"

interface PillView {
  cls: string
  label: string
}

const PRIORITY_VIEW: Record<Priority, PillView> = {
  low: { cls: "status-new", label: "Low" },
  med: { cls: "status-progress", label: "Med" },
  high: { cls: "status-flag", label: "High" },
}

const TONE_CLASS: Record<ModerationTone, string> = {
  ok: "status-ok",
  warn: "status-progress",
  bad: "status-flag",
}

const KIND_ICON: Record<ModerationKind, IconComponent> = {
  image: Icons.Eye,
  pattern: Icons.Activity,
  appeal: Icons.MessageSquare,
  gps: Icons.Pin,
  duplicate: Icons.Copy,
  user_report: Icons.Flag,
}

// The fallbacks below cover an enum value newer than this build, which the client passes through.
export function priorityView(priority: Priority): PillView {
  return PRIORITY_VIEW[priority] ?? PRIORITY_VIEW.low
}

export function toneClass(tone: ModerationTone): string {
  return TONE_CLASS[tone] ?? TONE_CLASS.ok
}

export function kindIcon(kind: ModerationKind): IconComponent {
  return KIND_ICON[kind] ?? Icons.Shield
}

export function moderationKindLabel(item: Pick<ModerationListItemDTO, "kind" | "subjectType">): string {
  if (item.kind === "user_report" && item.subjectType) return `Reported ${item.subjectType}`
  return MODERATION_KIND_LABELS[item.kind]
}

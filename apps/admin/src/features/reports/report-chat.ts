import {
  ADMIN_REPORT_STATUS_LABELS,
  type ChatMessageDTO,
  type ReactionEmoji,
} from "@civfix/shared"

export function msgWhen(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export function systemLabel(msg: ChatMessageDTO): string {
  const status = msg.system?.status
  const detail = msg.system?.note?.trim() || msg.system?.body?.trim() || msg.body?.trim()
  const head = status ? `System · ${ADMIN_REPORT_STATUS_LABELS[status] ?? status}` : "System"
  return detail ? `${head} · ${detail}` : head
}

function chatTime(msg: ChatMessageDTO): number {
  const t = Date.parse(msg.createdAt)
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t
}

export function sortChatOldestFirst(items: readonly ChatMessageDTO[]): ChatMessageDTO[] {
  return [...items].sort((a, b) => {
    const ta = chatTime(a)
    const tb = chatTime(b)
    if (ta !== tb) return ta < tb ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

const REACTION_LABEL: Record<ReactionEmoji, string> = {
  like: "Like",
  heart: "Love",
  celebrate: "Celebrate",
  support: "Support",
  insightful: "Insightful",
  concerned: "Concerned",
  laugh: "Laugh",
  sad: "Sad",
}

// The summary's emoji is an open string on the wire, so a reaction newer than this build shows raw.
export function reactionLabel(emoji: string): string {
  return Object.hasOwn(REACTION_LABEL, emoji) ? REACTION_LABEL[emoji as ReactionEmoji] : emoji
}

import {
  InboxFeedFilterSchema,
  type InboxFeedFilter,
  type InboxFeedItemDTO,
  type InboxFeedReplyItemDTO,
} from "@civfix/shared"

type FeedSource = InboxFeedItemDTO["source"]

export const INBOX_FEED_FILTER_ORDER: readonly InboxFeedFilter[] = InboxFeedFilterSchema.options

export const INBOX_EMPTY_COPY: Record<InboxFeedFilter, { title: string; sub: string }> = {
  all: { title: "Inbox is empty", sub: "City replies and other mail sent to civfix show up here." },
  unread: { title: "All caught up", sub: "No unread mail." },
  replies: { title: "No replies yet", sub: "Replies to report and event forwards show up here." },
  review: { title: "Nothing to review", sub: "Replies held back from a report chat or event show up here." },
  unmatched: { title: "No other mail", sub: "Mail that isn't a reply to a forward shows up here." },
  archived: { title: "Nothing archived", sub: "Archived mail shows up here." },
}

export function feedKey(item: { source: FeedSource; id: string }): string {
  return `${item.source}:${item.id}`
}

export function emailFocusKey(id: string): string {
  return feedKey({ source: "email", id })
}

export function parseFeedKey(key: string): { source: FeedSource; id: string } | null {
  const at = key.indexOf(":")
  const source = key.slice(0, at)
  const id = key.slice(at + 1)
  if (at < 1 || !id || (source !== "email" && source !== "reply")) return null
  return { source, id }
}

export function resolveFeedSelection<T extends { source: FeedSource; id: string }>(
  feedByKey: ReadonlyMap<string, T>,
  picked: T | null,
  selKey: string | null,
): T | undefined {
  const listed = selKey ? feedByKey.get(selKey) : undefined
  return listed ?? (picked && feedKey(picked) === selKey ? picked : undefined)
}

export function isInboxFeedFilter(value: string): value is InboxFeedFilter {
  return InboxFeedFilterSchema.safeParse(value).success
}

export function replyOriginLabel(item: Pick<InboxFeedReplyItemDTO, "reportId" | "cleanupId">): string {
  if (item.reportId) return "Report reply"
  if (item.cleanupId) return "Event reply"
  return "Thread reply"
}

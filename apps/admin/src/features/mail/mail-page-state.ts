import type {
  InboxFeedFilter,
  InboxFeedQuery,
  MailListQuery,
  MailThreadDTO,
} from "@civfix/shared"

import { emailFocusKey, isInboxFeedFilter } from "@/features/inbox/inbox-feed"
import { EMPTY_VALUE } from "@/lib/empty-value"

export type Folder = "outreach" | "inbox"

export const FOLDERS: readonly Folder[] = ["outreach", "inbox"]

export type OutreachBox = "all" | "in" | "out" | "attn"

/** The chip picked in the toolbar: an outreach box in Outreach, a feed filter in the Inbox. */
export type MailBox = OutreachBox | InboxFeedFilter

export const OUTREACH_BOXES: readonly { value: OutreachBox; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in", label: "Inbound" },
  { value: "out", label: "Outbound" },
  { value: "attn", label: "Needs attention" },
]

const INBOX_FOCUS_PREFIX = "inbox:"

export function outreachBoxLabel(box: MailBox): string {
  return OUTREACH_BOXES.find((b) => b.value === box)?.label ?? "All"
}

export function mailboxFeedFilter(box: MailBox): InboxFeedFilter {
  return isInboxFeedFilter(box) ? box : "all"
}

// Absent filters stay undefined rather than null or "", so the default view hashes to the same query
// key as the inactive folder's constant params and a folder switch lands on an already warm cache.
export function outreachParams(box: MailBox, q: string | undefined): MailListQuery {
  return {
    dir: box === "in" ? "in" : box === "out" ? "out" : undefined,
    filter: box === "attn" ? "attn" : undefined,
    q,
  }
}

export function mailListParams(folder: Folder, box: MailBox, q: string | undefined): MailListQuery {
  return folder === "outreach" ? outreachParams(box, q) : {}
}

export function inboxFeedParams(folder: Folder, box: MailBox, q: string | undefined): InboxFeedQuery {
  return folder === "inbox" ? { filter: mailboxFeedFilter(box), q } : { filter: "all" }
}

export function parseFocus(focusId: string | null): { folder: Folder; id: string | null } {
  if (!focusId) return { folder: "outreach", id: null }
  if (focusId.startsWith(INBOX_FOCUS_PREFIX)) {
    const id = focusId.slice(INBOX_FOCUS_PREFIX.length)
    return { folder: "inbox", id: id ? emailFocusKey(id) : null }
  }
  return { folder: "outreach", id: focusId }
}

export function correspondent(thread: MailThreadDTO): string {
  for (let i = thread.messages.length - 1; i >= 0; i--) {
    const message = thread.messages[i]!
    if (message.dir === "in" && message.from) return message.from
  }
  for (let i = thread.messages.length - 1; i >= 0; i--) {
    const message = thread.messages[i]!
    if (message.dir === "out" && message.to) return message.to
  }
  return thread.to || EMPTY_VALUE
}

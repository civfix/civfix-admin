"use client"

import type { InboxFeedItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { parseFeedKey } from "@/features/inbox/inbox-feed"
import { InboxReader } from "@/features/inbox/inbox-views"
import { MailReader } from "@/features/mail/mail-reader"

function InboxFeedReader({
  selectedKey,
  item,
}: {
  selectedKey: string
  item: InboxFeedItemDTO | undefined
}) {
  if (item?.source === "reply") {
    return <MailReader threadId={item.threadId} eventId={item.cleanupId} />
  }
  const parsed = parseFeedKey(selectedKey)
  if (parsed?.source === "email") return <InboxReader id={parsed.id} />
  return <EmptyState title="No message selected" icon={<Icons.Inbox size={20} />} />
}

interface MailDetailPaneProps {
  outreach: boolean
  selectedId: string | null
  selectedFeedItem: InboxFeedItemDTO | undefined
}

function SelectedReader({ outreach, selectedId, selectedFeedItem }: MailDetailPaneProps) {
  if (!selectedId) {
    return (
      <EmptyState
        title="No message selected"
        icon={outreach ? <Icons.Mail size={20} /> : <Icons.Inbox size={20} />}
      />
    )
  }
  if (outreach) return <MailReader key={selectedId} threadId={selectedId} />
  return <InboxFeedReader key={selectedId} selectedKey={selectedId} item={selectedFeedItem} />
}

export function MailDetailPane(props: MailDetailPaneProps) {
  return (
    <section className="card md-detail-card">
      <SelectedReader {...props} />
    </section>
  )
}

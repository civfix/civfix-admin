"use client"

import {
  INBOX_FEED_FILTER_LABELS,
  type InboxFeedFilter,
  type InboxFeedItemDTO,
  type MailStatsResponse,
  type MailThreadListItemDTO,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import {
  ListCard,
  ListStates,
  LoadMoreButton,
  type ListLoadState,
  type NextPageState,
} from "@/components/shared/section-list"
import { INBOX_EMPTY_COPY, feedKey } from "@/features/inbox/inbox-feed"
import { InboxRow } from "@/features/inbox/inbox-views"
import { outreachBoxLabel, type MailBox } from "@/features/mail/mail-page-state"
import { MailRow } from "@/features/mail/mail-row"

interface MailListPaneProps {
  outreach: boolean
  box: MailBox
  feedFilter: InboxFeedFilter
  searchTerm: string | undefined
  stats: MailStatsResponse | undefined
  listQuery: ListLoadState & NextPageState
  activeCount: number
  mailItems: MailThreadListItemDTO[]
  feedItems: InboxFeedItemDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}

function EmptyList({
  outreach,
  feedFilter,
  searching,
}: {
  outreach: boolean
  feedFilter: InboxFeedFilter
  searching: boolean
}) {
  if (searching) {
    return (
      <EmptyState title="Nothing matches" sub="Try a different search." icon={<Icons.Search size={20} />} />
    )
  }
  if (outreach) {
    return <EmptyState title="Empty" sub="No messages here." icon={<Icons.Mail size={20} />} />
  }
  return (
    <EmptyState
      title={INBOX_EMPTY_COPY[feedFilter].title}
      sub={INBOX_EMPTY_COPY[feedFilter].sub}
      icon={<Icons.Inbox size={20} />}
    />
  )
}

function ListRows({
  outreach,
  mailItems,
  feedItems,
  selectedId,
  onSelect,
}: Pick<MailListPaneProps, "outreach" | "mailItems" | "feedItems" | "selectedId" | "onSelect">) {
  if (outreach) {
    return mailItems.map((t) => (
      <MailRow key={t.id} item={t} selected={selectedId === t.id} onClick={() => onSelect(t.id)} />
    ))
  }
  return feedItems.map((item) => {
    const key = feedKey(item)
    return (
      <InboxRow key={key} item={item} selected={selectedId === key} onClick={() => onSelect(key)} />
    )
  })
}

function ListBody(props: MailListPaneProps) {
  const { outreach, feedFilter, searchTerm, listQuery, activeCount } = props
  return (
    <ListStates
      query={listQuery}
      loadingLabel={outreach ? "Loading mail..." : "Loading inbox..."}
      isEmpty={activeCount === 0}
      empty={<EmptyList outreach={outreach} feedFilter={feedFilter} searching={!!searchTerm} />}
    >
      <ListRows {...props} />
      <LoadMoreButton query={listQuery} className="list-load-more" />
    </ListStates>
  )
}

export function MailListPane(props: MailListPaneProps) {
  const { outreach, box, feedFilter, searchTerm, stats, listQuery, activeCount } = props
  const serverTotal = outreach && box === "all" && !searchTerm ? stats?.threads : undefined
  const countLabel =
    serverTotal !== undefined
      ? serverTotal.toLocaleString()
      : `${activeCount}${listQuery.hasNextPage ? "+" : ""}`

  return (
    <ListCard
      title={outreach ? outreachBoxLabel(box) : INBOX_FEED_FILTER_LABELS[feedFilter]}
      meta={countLabel}
    >
      <ListBody {...props} />
    </ListCard>
  )
}

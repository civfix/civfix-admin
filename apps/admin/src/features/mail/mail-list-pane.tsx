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
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { INBOX_EMPTY_COPY, feedKey } from "@/features/inbox/inbox-feed"
import { InboxRow } from "@/features/inbox/inbox-views"
import { outreachBoxLabel, type MailBox } from "@/features/mail/mail-page-state"
import { MailRow } from "@/features/mail/mail-row"

interface ListQueryState {
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
}

interface MailListPaneProps {
  outreach: boolean
  box: MailBox
  feedFilter: InboxFeedFilter
  searchTerm: string | undefined
  stats: MailStatsResponse | undefined
  listQuery: ListQueryState
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
  if (listQuery.isLoading) {
    return <LoadingState label={outreach ? "Loading mail..." : "Loading inbox..."} />
  }
  if (listQuery.isError) {
    return <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
  }
  if (activeCount === 0) {
    return <EmptyList outreach={outreach} feedFilter={feedFilter} searching={!!searchTerm} />
  }
  return (
    <>
      <ListRows {...props} />
      {listQuery.hasNextPage && (
        <button
          type="button"
          className="btn"
          style={{ width: "calc(100% - 20px)", margin: "8px 10px" }}
          disabled={listQuery.isFetchingNextPage}
          onClick={() => listQuery.fetchNextPage()}
        >
          {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </>
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
    <section className="card md-list">
      <div className="card-head">
        <h3>{outreach ? outreachBoxLabel(box) : INBOX_FEED_FILTER_LABELS[feedFilter]}</h3>
        <div className="spacer" />
        <span className="meta">{countLabel}</span>
      </div>
      <div className="queue-list">
        <ListBody {...props} />
      </div>
    </section>
  )
}

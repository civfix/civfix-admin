"use client"

import * as React from "react"
import type { UserMessageItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { promptDialog } from "@/components/shared/dialog"
import { flatPages } from "@/lib/infinite"
import {
  useRemoveUserMessage,
  useUserEventListInfinite,
  useUserMessageListInfinite,
  useUserReportListInfinite,
} from "@/features/users/use-users"
import {
  ProfileEventRow,
  ProfileMessageRow,
  ProfileReportRow,
} from "@/features/users/profile-activity-rows"
import { useNav } from "@/store/ui-store"

export type ProfileTab = "reports" | "events" | "messages"

interface ActivityQuery<T> {
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
  data?: { pages: { items: T[] }[] }
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
}

function LoadMore({ query }: { query: ActivityQuery<unknown> }) {
  if (!query.hasNextPage) return null
  return (
    <button
      type="button"
      className="btn load-more"
      disabled={query.isFetchingNextPage}
      onClick={() => void query.fetchNextPage()}
    >
      {query.isFetchingNextPage ? "Loading…" : "Load more"}
    </button>
  )
}

function ActivityList<T>({
  query,
  loadingLabel,
  empty,
  renderItem,
}: {
  query: ActivityQuery<T>
  loadingLabel: string
  empty: { title: string; sub: string; icon: React.ReactNode }
  renderItem: (item: T) => React.ReactNode
}) {
  if (query.isLoading) return <LoadingState label={loadingLabel} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  const items = flatPages(query.data)
  if (!items.length) return <EmptyState title={empty.title} sub={empty.sub} icon={empty.icon} />
  return (
    <>
      {items.map(renderItem)}
      <LoadMore query={query} />
    </>
  )
}

export function UserActivity({ userId, tab }: { userId: string; tab: ProfileTab }) {
  const nav = useNav()
  const reports = useUserReportListInfinite(tab === "reports" ? userId : null)
  const events = useUserEventListInfinite(tab === "events" ? userId : null)
  const messages = useUserMessageListInfinite(tab === "messages" ? userId : null)
  const removeMessage = useRemoveUserMessage()

  const onRemoveMessage = async (message: UserMessageItemDTO) => {
    const reason = await promptDialog({ title: "Remove message", label: "Reason (optional)" })
    if (reason === null) return
    removeMessage.mutate({ id: userId, messageId: message.id, ...(reason ? { reason } : {}) })
  }

  if (tab === "reports") {
    return (
      <ActivityList
        query={reports}
        loadingLabel="Loading reports..."
        empty={{
          title: "No reports yet",
          sub: "This neighbor hasn't filed any reports.",
          icon: <Icons.Layers size={20} />,
        }}
        renderItem={(report) => <ProfileReportRow key={report.id} report={report} nav={nav} />}
      />
    )
  }

  if (tab === "events") {
    return (
      <ActivityList
        query={events}
        loadingLabel="Loading cleanups..."
        empty={{
          title: "No cleanup events yet",
          sub: "This neighbor hasn't joined any cleanups.",
          icon: <Icons.Calendar size={20} />,
        }}
        renderItem={(event) => <ProfileEventRow key={event.id} event={event} nav={nav} />}
      />
    )
  }

  return (
    <ActivityList
      query={messages}
      loadingLabel="Loading messages..."
      empty={{
        title: "No messages yet",
        sub: "This neighbor hasn't sent any messages.",
        icon: <Icons.MessageSquare size={20} />,
      }}
      renderItem={(message) => (
        <ProfileMessageRow
          key={message.id}
          message={message}
          onRemove={onRemoveMessage}
          removing={removeMessage.isPending}
          nav={nav}
        />
      )}
    />
  )
}

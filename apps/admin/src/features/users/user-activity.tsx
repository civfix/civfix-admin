"use client"

import * as React from "react"
import type { UserMessageItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { ListStates, LoadMoreButton } from "@/components/shared/section-list"
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
  const items = flatPages(query.data)
  return (
    <ListStates
      query={query}
      loadingLabel={loadingLabel}
      isEmpty={!items.length}
      empty={<EmptyState title={empty.title} sub={empty.sub} icon={empty.icon} />}
    >
      {items.map(renderItem)}
      <LoadMoreButton query={query} className="load-more" />
    </ListStates>
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

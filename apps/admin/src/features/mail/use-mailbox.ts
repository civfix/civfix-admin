"use client"

import * as React from "react"
import type { InboxFeedItemDTO } from "@civfix/shared"

import { feedKey, resolveFeedSelection } from "@/features/inbox/inbox-feed"
import { useInboxFeedInfinite, useSetInboxStatus } from "@/features/inbox/use-inbox"
import {
  feedFilterOf,
  inboxFeedParams,
  mailListParams,
  parseFocus,
  type Folder,
  type MailBox,
} from "@/features/mail/mail-page-state"
import { useMailListInfinite, useMarkMailRead } from "@/features/mail/use-mail"
import { SEARCH_DEBOUNCE_MS } from "@/lib/timing"

function useMailSearch() {
  const [query, setQuery] = React.useState("")
  const [debouncedQuery, setDebouncedQuery] = React.useState("")
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query])
  const clear = () => {
    setQuery("")
    setDebouncedQuery("")
  }
  return { query, setQuery, searchTerm: debouncedQuery || undefined, clear }
}

// Both folders' lists stay mounted: the inactive one keeps its default params, which is exactly the
// view a folder switch lands on, so the switch renders from cache.
function useMailboxLists(folder: Folder, box: MailBox, searchTerm: string | undefined) {
  const outreach = folder === "outreach"
  const mailListQuery = useMailListInfinite(mailListParams(folder, box, searchTerm))
  const inboxFeedQuery = useInboxFeedInfinite(inboxFeedParams(folder, box, searchTerm))

  const mailItems = React.useMemo(
    () => mailListQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [mailListQuery.data],
  )
  const feedItems = React.useMemo(
    () => inboxFeedQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [inboxFeedQuery.data],
  )
  const feedByKey = React.useMemo(
    () => new Map<string, InboxFeedItemDTO>(feedItems.map((item) => [feedKey(item), item])),
    [feedItems],
  )
  const activeIds = React.useMemo(
    () => (outreach ? mailItems.map((t) => t.id) : [...feedByKey.keys()]),
    [outreach, mailItems, feedByKey],
  )
  const activeUnread = React.useMemo(
    () =>
      new Set(
        outreach
          ? mailItems.filter((t) => t.unread).map((t) => t.id)
          : [...feedByKey].filter(([, item]) => item.unread).map(([key]) => key),
      ),
    [outreach, mailItems, feedByKey],
  )

  return {
    mailItems,
    feedItems,
    feedByKey,
    activeIds,
    activeUnread,
    activeListQuery: outreach ? mailListQuery : inboxFeedQuery,
    activeCount: outreach ? mailItems.length : feedItems.length,
  }
}

type MailboxLists = ReturnType<typeof useMailboxLists>

// Only a fresh load of a folder picks a message on the operator's behalf, and a deep-linked message
// is never replaced. A pick that a filter or search leaves out stays open through its by-id reader; a
// pick that drops out of the same list after a refetch clears, so the pane never jumps to another
// message. Opening an unread message reads it, which is not the operator's action: until the list
// shows it read, dropping out (the Unread or Needs attention chip) counts as a filter drop-out and
// the message stays open. Decided only on data fetched for the current folder and filters.
function useSelectionFollowsList({
  selectedId,
  setSelectedId,
  listKey,
  lists,
  autoPickFirst,
}: {
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  listKey: string
  lists: MailboxLists
  autoPickFirst: boolean
}) {
  const [autoPick, setAutoPick] = React.useState(autoPickFirst)
  const seenIn = React.useRef<{ id: string; list: string } | null>(null)
  const readOnOpen = React.useRef<string | null>(null)
  const { activeListQuery, activeIds, activeUnread } = lists
  React.useEffect(() => {
    if (!activeListQuery.isSuccess || activeListQuery.isFetching) return
    if (selectedId === null) {
      if (autoPick && activeIds.length) setSelectedId(activeIds[0]!)
      return
    }
    setAutoPick(false)
    if (activeIds.includes(selectedId)) {
      seenIn.current = { id: selectedId, list: listKey }
      if (readOnOpen.current === selectedId && !activeUnread.has(selectedId)) readOnOpen.current = null
    } else if (seenIn.current?.id === selectedId && seenIn.current.list === listKey) {
      if (readOnOpen.current === selectedId) {
        readOnOpen.current = null
        seenIn.current = null
      } else {
        setSelectedId(null)
      }
    }
  }, [
    activeListQuery.isSuccess,
    activeListQuery.isFetching,
    activeIds,
    activeUnread,
    selectedId,
    listKey,
    autoPick,
    setSelectedId,
  ])
  return { readOnOpen, restartAutoPick: () => setAutoPick(true) }
}

export function useMailbox(focusId: string | null) {
  const initial = parseFocus(focusId)
  const [folder, setFolder] = React.useState<Folder>(initial.folder)
  const [box, setBox] = React.useState<MailBox>("all")
  const [selectedId, setSelectedId] = React.useState<string | null>(initial.id)
  const [pickedFeedItem, setPickedFeedItem] = React.useState<InboxFeedItemDTO | null>(null)
  const search = useMailSearch()
  const outreach = folder === "outreach"

  const markRead = useMarkMailRead()
  const setInboxStatus = useSetInboxStatus({ quiet: true })
  const lists = useMailboxLists(folder, box, search.searchTerm)
  const { mailItems, feedByKey } = lists

  React.useEffect(() => {
    if (!focusId) return
    const focus = parseFocus(focusId)
    setFolder(focus.folder)
    setBox("all")
    setSelectedId(focus.id)
  }, [focusId])
  React.useEffect(() => {
    const listed = selectedId ? feedByKey.get(selectedId) : undefined
    if (listed) setPickedFeedItem(listed)
  }, [selectedId, feedByKey])
  const { readOnOpen, restartAutoPick } = useSelectionFollowsList({
    selectedId,
    setSelectedId,
    listKey: JSON.stringify([folder, box, search.searchTerm ?? null]),
    lists,
    autoPickFirst: initial.id === null,
  })

  const openFresh = (next: Folder) => {
    setFolder(next)
    setBox("all")
    setSelectedId(null)
    restartAutoPick()
  }

  const switchFolder = (next: Folder) => {
    if (next === folder) return
    openFresh(next)
    search.clear()
  }

  const select = (id: string) => {
    setSelectedId(id)
    readOnOpen.current = null
    const readFailed = {
      onError: () => {
        if (readOnOpen.current === id) readOnOpen.current = null
      },
    }
    if (outreach) {
      const row = mailItems.find((t) => t.id === id)
      if (!row?.unread) return
      readOnOpen.current = id
      markRead.mutate({ id }, readFailed)
      return
    }
    const item = feedByKey.get(id)
    if (!item?.unread) return
    readOnOpen.current = id
    if (item.source === "email") setInboxStatus.mutate({ id: item.id, status: "read" }, readFailed)
    else markRead.mutate({ id: item.threadId }, readFailed)
  }

  return {
    folder,
    outreach,
    box,
    setBox,
    feedFilter: feedFilterOf(box),
    search,
    lists,
    selectedId,
    selectedFeedItem: outreach
      ? undefined
      : resolveFeedSelection(feedByKey, pickedFeedItem, selectedId),
    select,
    openFresh,
    switchFolder,
  }
}

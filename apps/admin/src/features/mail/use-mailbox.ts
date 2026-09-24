"use client"

import * as React from "react"
import type { InboxFeedItemDTO } from "@civfix/shared"

import { feedKey, resolveFeedSelection } from "@/features/inbox/inbox-feed"
import { useInboxFeedInfinite, useSetInboxStatus } from "@/features/inbox/use-inbox"
import {
  mailboxFeedFilter,
  inboxFeedParams,
  mailListParams,
  parseFocus,
  type Folder,
  type MailBox,
} from "@/features/mail/mail-page-state"
import { useMailListInfinite, useMarkMailRead } from "@/features/mail/use-mail"
import { SEARCH_DEBOUNCE_MS } from "@/lib/timing"
import { flatPages } from "@/lib/infinite"
import { useSelection } from "@/hooks/use-selection"

const ownId = (id: string) => id

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
    () => flatPages(mailListQuery.data),
    [mailListQuery.data],
  )
  const feedItems = React.useMemo(
    () => flatPages(inboxFeedQuery.data),
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

export function useMailbox(focusId: string | null) {
  const initial = parseFocus(focusId)
  const [folder, setFolder] = React.useState<Folder>(initial.folder)
  const [box, setBox] = React.useState<MailBox>("all")
  const [pickedFeedItem, setPickedFeedItem] = React.useState<InboxFeedItemDTO | null>(null)
  const search = useMailSearch()
  const outreach = folder === "outreach"

  const markRead = useMarkMailRead()
  const setInboxStatus = useSetInboxStatus({ quiet: true })
  const lists = useMailboxLists(folder, box, search.searchTerm)
  const { mailItems, feedByKey } = lists
  // Opening an unread message reads it, so the Unread or Needs attention chip would otherwise close it.
  // A folder switch or a sent message is a fresh load, which picks again.
  const { selectedId, setSelectedId, readOnOpen, restartAutoPick } = useSelection({
    focusId: initial.id,
    syncFocus: false,
    list: lists.activeListQuery,
    items: lists.activeIds,
    getId: ownId,
    listKey: JSON.stringify([folder, box, search.searchTerm ?? null]),
    unreadIds: lists.activeUnread,
  })

  React.useEffect(() => {
    if (!focusId) return
    const focus = parseFocus(focusId)
    setFolder(focus.folder)
    setBox("all")
    setSelectedId(focus.id)
  }, [focusId, setSelectedId])
  React.useEffect(() => {
    const listed = selectedId ? feedByKey.get(selectedId) : undefined
    if (listed) setPickedFeedItem(listed)
  }, [selectedId, feedByKey])

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
    feedFilter: mailboxFeedFilter(box),
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

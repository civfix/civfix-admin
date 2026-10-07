"use client"

import * as React from "react"

interface SelectionListState {
  isSuccess: boolean
  isFetching: boolean
}

export interface SelectionOptions<T, Id extends string> {
  /** The deep-linked id: the initial pick, and it suppresses the first-load auto-pick. */
  focusId: Id | null
  /** False when the page applies deep links itself because they move other state with the pick. */
  syncFocus?: boolean
  list: SelectionListState
  items: readonly T[]
  /** Keep it module-level: it is an effect dependency. */
  getId: (item: T) => Id
  /** Identifies the params the list was fetched with, so a drop-out is judged against the same list. */
  listKey: string
  /** False when the detail has no by-id read: any unlisted pick clears except the deep link. */
  readableById?: boolean
  /**
   * Opening an unread row reads it, which is not the operator's action: while the returned `readOnOpen`
   * holds the pick, dropping out of an unread-only list counts as a filter drop-out until the list
   * shows it read.
   */
  unreadIds?: ReadonlySet<Id>
  /** Keep showing the last listed row for a pick that a filter or search leaves out. */
  keepLastSeen?: boolean
}

export function idOf<T extends { id: string }>(item: T): string {
  return item.id
}

export function resolveSelected<T, Id extends string>(
  items: readonly T[],
  selectedId: Id | null,
  lastSeen: T | null,
  getId: (item: T) => Id,
): T | null {
  if (selectedId === null) return null
  return (
    items.find((item) => getId(item) === selectedId) ??
    (lastSeen !== null && getId(lastSeen) === selectedId ? lastSeen : null)
  )
}

// Every master-detail page follows one rule. Only a first load with no deep link picks on the
// operator's behalf, and a deep link always wins. A pick that a filter or search leaves out stays open
// (the detail reads it by id); a pick that drops out of the SAME list after a refetch (a ban under the
// Active chip, a verdict under Needs verification) clears, so the pane never jumps to another row's live
// action buttons and is never replaced by the first row. Each decision waits for data fetched for the
// current params: a cached page that is refetching may predate the change that matters.
export function useSelection<T, Id extends string>({
  focusId,
  syncFocus = true,
  list,
  items,
  getId,
  listKey,
  readableById = true,
  unreadIds,
  keepLastSeen = false,
}: SelectionOptions<T, Id>) {
  const [selectedId, setSelectedId] = React.useState<Id | null>(focusId)
  const [autoPick, setAutoPick] = React.useState(focusId === null)
  const [lastSeen, setLastSeen] = React.useState<T | null>(null)
  const seenIn = React.useRef<{ id: Id; list: string } | null>(null)
  const readOnOpen = React.useRef<Id | null>(null)

  React.useEffect(() => {
    if (syncFocus && focusId) setSelectedId(focusId)
  }, [syncFocus, focusId])

  const selectedItem = resolveSelected(items, selectedId, keepLastSeen ? lastSeen : null, getId)
  React.useEffect(() => {
    if (keepLastSeen && selectedItem && selectedItem !== lastSeen) setLastSeen(selectedItem)
  }, [keepLastSeen, selectedItem, lastSeen])

  const { isSuccess, isFetching } = list
  const linkedId = readableById ? null : focusId
  React.useEffect(() => {
    if (!isSuccess || isFetching) return
    if (selectedId === null) {
      if (autoPick && items.length) setSelectedId(getId(items[0]!))
      return
    }
    setAutoPick(false)
    if (items.some((item) => getId(item) === selectedId)) {
      seenIn.current = { id: selectedId, list: listKey }
      if (readOnOpen.current === selectedId && !unreadIds?.has(selectedId)) readOnOpen.current = null
    } else if (
      (!readableById && selectedId !== linkedId) ||
      (seenIn.current?.id === selectedId && seenIn.current.list === listKey)
    ) {
      if (readOnOpen.current === selectedId) {
        readOnOpen.current = null
        seenIn.current = null
      } else {
        setSelectedId(null)
      }
    }
  }, [
    isSuccess,
    isFetching,
    items,
    getId,
    unreadIds,
    selectedId,
    listKey,
    autoPick,
    readableById,
    linkedId,
  ])

  const clearIfSelected = React.useCallback(
    (id: Id) => setSelectedId((current) => (current === id ? null : current)),
    [],
  )
  const restartAutoPick = React.useCallback(() => setAutoPick(true), [])

  return { selectedId, setSelectedId, selectedItem, clearIfSelected, restartAutoPick, readOnOpen }
}

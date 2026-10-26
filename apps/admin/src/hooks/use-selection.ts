"use client"

import * as React from "react"

import { useValueChanged } from "@/hooks/use-value-changed"

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
  getId: (item: T) => Id
  /** Identifies the params the list was fetched with, so a drop-out is judged against the same list. */
  listKey: string
  /** False when the detail has no by-id read: any unlisted pick clears except the deep link. */
  readableById?: boolean
  /**
   * Opening an unread row reads it, which is not the operator's action: while `setReadOnOpen` holds the
   * pick, dropping out of an unread-only list counts as a filter drop-out until the list
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

interface SelectionState<T, Id extends string> {
  selectedId: Id | null
  autoPick: boolean
  lastSeen: T | null
  /** Where the pick was last listed: a drop-out from that same list is judged, any other kept. */
  seenIn: { id: Id; list: string } | null
  readOnOpen: Id | null
}

interface ListSnapshot<T, Id extends string> {
  list: SelectionListState
  items: readonly T[]
  getId: (item: T) => Id
  listKey: string
  readableById: boolean
  linkedId: Id | null
  unreadIds: ReadonlySet<Id> | undefined
}

// A deep link that changes the pick wins even over an earlier drop-out of that row from this list;
// one naming the row already open keeps its drop-out tracking.
function focusOn<T, Id extends string>(state: SelectionState<T, Id>, focusId: Id): SelectionState<T, Id> {
  return state.selectedId === focusId ? state : { ...state, selectedId: focusId, seenIn: null }
}

// Returns `state` itself when nothing changes: the caller applies it while rendering, so any other
// result would render forever.
function reconcileWithList<T, Id extends string>(
  state: SelectionState<T, Id>,
  { list, items, getId, listKey, readableById, linkedId, unreadIds }: ListSnapshot<T, Id>,
): SelectionState<T, Id> {
  if (!list.isSuccess || list.isFetching) return state
  const id = state.selectedId
  if (id === null) {
    const first = items[0]
    return state.autoPick && first !== undefined ? { ...state, selectedId: getId(first) } : state
  }
  let next = state.autoPick ? { ...state, autoPick: false } : state
  const seenHere = next.seenIn?.id === id && next.seenIn.list === listKey
  if (items.some((item) => getId(item) === id)) {
    if (!seenHere) next = { ...next, seenIn: { id, list: listKey } }
    if (next.readOnOpen === id && !unreadIds?.has(id)) next = { ...next, readOnOpen: null }
    return next
  }
  if (!((!readableById && id !== linkedId) || seenHere)) return next
  return next.readOnOpen === id
    ? { ...next, readOnOpen: null, seenIn: null }
    : { ...next, selectedId: null }
}

function withLastSeen<T, Id extends string>(
  state: SelectionState<T, Id>,
  items: readonly T[],
  getId: (item: T) => Id,
): SelectionState<T, Id> {
  const item = resolveSelected(items, state.selectedId, state.lastSeen, getId)
  return item && item !== state.lastSeen ? { ...state, lastSeen: item } : state
}

// Every master-detail page follows one rule. Only a first load with no deep link picks on the
// operator's behalf, and a deep link always wins. A pick that a filter or search leaves out stays open
// (the detail reads it by id); a pick that drops out of the SAME list after a refetch (a ban under the
// Active chip, a verdict under Needs verification) clears, so the pane never jumps to another row's live
// action buttons and is never replaced by the first row. Each decision waits for data fetched for the
// current params: a cached page that is refetching may predate the change that matters. The decisions
// are made while rendering, so a pane never paints a pick the list has already overruled.
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
  const [state, setState] = React.useState<SelectionState<T, Id>>(() => ({
    selectedId: focusId,
    autoPick: focusId === null,
    lastSeen: null,
    seenIn: null,
    readOnOpen: null,
  }))
  const focusChanged = useValueChanged(focusId)

  let next = focusChanged && syncFocus && focusId ? focusOn(state, focusId) : state
  next = reconcileWithList(next, {
    list,
    items,
    getId,
    listKey,
    readableById,
    linkedId: readableById ? null : focusId,
    unreadIds,
  })
  if (keepLastSeen) next = withLastSeen(next, items, getId)
  if (next !== state) setState(next)

  const setSelectedId = React.useCallback(
    (id: Id | null) => setState((s) => (s.selectedId === id ? s : { ...s, selectedId: id })),
    [],
  )
  const clearIfSelected = React.useCallback(
    (id: Id) => setState((s) => (s.selectedId === id ? { ...s, selectedId: null } : s)),
    [],
  )
  const restartAutoPick = React.useCallback(
    () => setState((s) => (s.autoPick ? s : { ...s, autoPick: true })),
    [],
  )
  const setReadOnOpen = React.useCallback(
    (id: Id | null) => setState((s) => (s.readOnOpen === id ? s : { ...s, readOnOpen: id })),
    [],
  )
  /** Lets go of `id` only if it is still the held pick: a later open may have replaced it. */
  const releaseReadOnOpen = React.useCallback(
    (id: Id) => setState((s) => (s.readOnOpen === id ? { ...s, readOnOpen: null } : s)),
    [],
  )

  return {
    selectedId: next.selectedId,
    setSelectedId,
    selectedItem: resolveSelected(items, next.selectedId, keepLastSeen ? next.lastSeen : null, getId),
    clearIfSelected,
    restartAutoPick,
    readOnOpen: next.readOnOpen,
    setReadOnOpen,
    releaseReadOnOpen,
  }
}

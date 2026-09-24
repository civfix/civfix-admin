"use client"

import * as React from "react"
import type { AdminUserListQuery, AdminUserListResponse } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { useDebounced } from "@/hooks/use-debounced"
import { SEARCH_DEBOUNCE_MS } from "@/lib/timing"
import { flatPages } from "@/lib/infinite"
import { useUserListInfinite } from "@/features/users/use-users"
import { UserDetail } from "@/features/users/user-detail"
import { UserListPane } from "@/features/users/user-list-pane"
import { userSearchTerm } from "./user-search"
import type { SectionPageProps } from "@/components/shell/page-registry"

type UserFilter = "all" | NonNullable<AdminUserListQuery["filter"]>

function filterOptions(counts: AdminUserListResponse["counts"] | undefined) {
  return [
    { value: "all", label: "All", count: counts?.all },
    { value: "active", label: "Active", count: counts?.active },
    { value: "suspended", label: "Suspended", count: counts?.suspended },
    { value: "flagged", label: "Flagged", count: counts?.flagged },
    { value: "banned", label: "Banned", count: counts?.banned },
    { value: "deleted", label: "Deleted", count: counts?.deleted },
  ]
}

export function UsersPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<UserFilter>("all")
  const [query, setQuery] = React.useState("")
  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS)
  const [selectedId, setSelectedId] = React.useState<string | null>(focusId)

  const searchTerm = userSearchTerm(debouncedQuery)
  const listParams: AdminUserListQuery = {
    ...(filter === "all" ? {} : { filter }),
    ...(searchTerm ? { q: searchTerm } : {}),
  }
  const listKey = JSON.stringify(listParams)
  const listQuery = useUserListInfinite(listParams)
  const items = React.useMemo(
    () => flatPages(listQuery.data),
    [listQuery.data],
  )

  const counts = listQuery.data?.pages[0]?.counts

  React.useEffect(() => {
    if (focusId) setSelectedId(focusId)
  }, [focusId])
  // The selection rules every master-detail page follows: only the first load picks on the operator's
  // behalf. A pick that a filter or search leaves out stays open, because the detail reads it by id. A
  // pick that drops out of the same list after a refetch (a ban under the Active chip, say) clears, so
  // the pane never jumps to another account's Ban button. Each decision waits for data fetched for the
  // current params: a cached page that is refetching may predate the change that matters.
  const [autoPick, setAutoPick] = React.useState(focusId === null)
  const seenIn = React.useRef<{ id: string; list: string } | null>(null)
  React.useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isFetching) return
    if (selectedId === null) {
      if (autoPick && items.length) setSelectedId(items[0]!.id)
      return
    }
    setAutoPick(false)
    if (items.some((x) => x.id === selectedId)) seenIn.current = { id: selectedId, list: listKey }
    else if (seenIn.current?.id === selectedId && seenIn.current.list === listKey) setSelectedId(null)
  }, [listQuery.isSuccess, listQuery.isFetching, items, selectedId, listKey, autoPick])

  return (
    <>
      <PageHead
        title="Users"
        subtitle={
          <span>
            Every neighbor on civfix and what they&apos;ve contributed: the reports they&apos;ve
            filed, cleanups they&apos;ve joined, and messages they&apos;ve sent.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={filterOptions(counts)}
          value={filter}
          onChange={(v) => setFilter(v as UserFilter)}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            aria-label="Search accounts"
            placeholder="Search name, handle, city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <UserListPane
          listQuery={listQuery}
          items={items}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        <section className="card md-detail-card">
          {selectedId ? (
            <UserDetail key={selectedId} userId={selectedId} />
          ) : (
            <EmptyState
              title="No user selected"
              sub="Pick an account from the list."
              icon={<Icons.Users size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

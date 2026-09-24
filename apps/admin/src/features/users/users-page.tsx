"use client"

import * as React from "react"
import type { AdminUserListQuery, AdminUserListResponse } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { SearchBox } from "@/components/shared/section-list"
import { useDebounced } from "@/hooks/use-debounced"
import { idOf, useSelection } from "@/hooks/use-selection"
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

  const searchTerm = userSearchTerm(debouncedQuery)
  const listParams: AdminUserListQuery = {
    ...(filter === "all" ? {} : { filter }),
    ...(searchTerm ? { q: searchTerm } : {}),
  }
  const listQuery = useUserListInfinite(listParams)
  const items = React.useMemo(
    () => flatPages(listQuery.data),
    [listQuery.data],
  )

  const counts = listQuery.data?.pages[0]?.counts

  const { selectedId, setSelectedId } = useSelection({
    focusId,
    list: listQuery,
    items,
    getId: idOf,
    listKey: JSON.stringify(listParams),
  })

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
        <SearchBox
          label="Search accounts"
          placeholder="Search name, handle, city…"
          value={query}
          onChange={setQuery}
        />
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

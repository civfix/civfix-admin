"use client"

import type { AdminUserListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { UserRow } from "@/features/users/user-row"
import type { useUserListInfinite } from "@/features/users/use-users"

type UserListQuery = ReturnType<typeof useUserListInfinite>

function UserListItems({
  listQuery,
  items,
  selectedId,
  onSelect,
}: {
  listQuery: UserListQuery
  items: AdminUserListItemDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (listQuery.isLoading) return <LoadingState label="Loading accounts..." />
  if (listQuery.isError) {
    return <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing matches"
        sub="Try a different filter or search."
        icon={<Icons.Search size={20} />}
      />
    )
  }
  return (
    <>
      {items.map((u) => (
        <UserRow
          key={u.id}
          user={u}
          selected={selectedId === u.id}
          onClick={() => onSelect(u.id)}
        />
      ))}
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

export function UserListPane({
  listQuery,
  items,
  selectedId,
  onSelect,
}: {
  listQuery: UserListQuery
  items: AdminUserListItemDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="card md-list">
      <div className="card-head">
        <h3>Accounts</h3>
        <div className="spacer" />
        <span className="meta">{items.length}</span>
      </div>
      <div className="queue-list">
        <UserListItems
          listQuery={listQuery}
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>
    </section>
  )
}

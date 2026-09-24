"use client"

import type { AdminUserListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { ListCard, ListStates, LoadMoreButton } from "@/components/shared/section-list"
import { UserRow } from "@/features/users/user-row"
import type { useUserListInfinite } from "@/features/users/use-users"

export function UserListPane({
  listQuery,
  items,
  selectedId,
  onSelect,
}: {
  listQuery: ReturnType<typeof useUserListInfinite>
  items: AdminUserListItemDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <ListCard title="Accounts" meta={items.length}>
      <ListStates
        query={listQuery}
        loadingLabel="Loading accounts..."
        isEmpty={items.length === 0}
        empty={
          <EmptyState
            title="Nothing matches"
            sub="Try a different filter or search."
            icon={<Icons.Search size={20} />}
          />
        }
      >
        {items.map((u) => (
          <UserRow key={u.id} user={u} selected={selectedId === u.id} onSelect={onSelect} />
        ))}
        <LoadMoreButton query={listQuery} className="list-load-more" />
      </ListStates>
    </ListCard>
  )
}

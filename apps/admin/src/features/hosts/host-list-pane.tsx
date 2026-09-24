"use client"

import type { AdminHostListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { ListCard, ListStates, LoadMoreButton } from "@/components/shared/section-list"
import { HostRow } from "@/features/hosts/host-row"
import { HOST_ACTIVITY_WINDOW_DAYS } from "@/features/hosts/host-window"
import type { useHostListInfinite } from "@/features/hosts/use-hosts"

export function HostListPane({
  listQuery,
  rows,
  selectedId,
  onSelect,
}: {
  listQuery: ReturnType<typeof useHostListInfinite>
  rows: AdminHostListItemDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <ListCard
      title="Hosts"
      meta={
        listQuery.isSuccess ? (
          <>
            {rows.length}
            {listQuery.hasNextPage ? "+" : ""}
          </>
        ) : undefined
      }
    >
      <ListStates query={listQuery} loadingLabel="Loading hosts...">
        {rows.length === 0 ? (
          <EmptyState
            title="No hosts here"
            sub={`No host matches this filter and search in the last ${HOST_ACTIVITY_WINDOW_DAYS} days.`}
            icon={<Icons.Send size={20} />}
          />
        ) : (
          rows.map((row) => (
            <HostRow
              key={row.host.id}
              row={row}
              selected={selectedId === row.host.id}
              onClick={() => onSelect(row.host.id)}
            />
          ))
        )}
        <LoadMoreButton query={listQuery} className="load-more" />
      </ListStates>
    </ListCard>
  )
}

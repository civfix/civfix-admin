"use client"

import type { AdminHostListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { HostRow } from "@/features/hosts/host-row"
import { HOST_ACTIVITY_WINDOW_DAYS } from "@/features/hosts/host-window"
import type { useHostListInfinite } from "@/features/hosts/use-hosts"

type HostListQuery = ReturnType<typeof useHostListInfinite>

export function HostListPane({
  listQuery,
  rows,
  selectedId,
  onSelect,
}: {
  listQuery: HostListQuery
  rows: AdminHostListItemDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="card md-list">
      <div className="card-head">
        <h3>Hosts</h3>
        <div className="spacer" />
        {listQuery.isSuccess && (
          <span className="meta">
            {rows.length}
            {listQuery.hasNextPage ? "+" : ""}
          </span>
        )}
      </div>
      <div className="queue-list">
        {listQuery.isLoading ? (
          <LoadingState label="Loading hosts..." />
        ) : listQuery.isError ? (
          <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
        ) : (
          <>
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
            {listQuery.hasNextPage && (
              <button
                type="button"
                className="btn load-more"
                disabled={listQuery.isFetchingNextPage}
                onClick={() => void listQuery.fetchNextPage()}
              >
                {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  )
}

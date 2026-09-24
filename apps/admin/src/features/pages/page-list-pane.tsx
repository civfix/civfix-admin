"use client"

import type { AdminEventPageListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { PageRow } from "@/features/pages/page-row"
import type { useEventPagesInfinite } from "@/features/pages/use-pages"

type PageListQuery = ReturnType<typeof useEventPagesInfinite>

export function PageListPane({
  listQuery,
  items,
  selectedId,
  onSelect,
}: {
  listQuery: PageListQuery
  items: AdminEventPageListItemDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="card md-list">
      <div className="card-head">
        <h3>Pages</h3>
        <div className="spacer" />
        {listQuery.isSuccess && (
          <span className="meta">
            {items.length}
            {listQuery.hasNextPage ? "+" : ""}
          </span>
        )}
      </div>
      <div className="queue-list">
        {listQuery.isLoading ? (
          <LoadingState label="Loading pages..." />
        ) : listQuery.isError ? (
          <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
        ) : (
          <>
            {items.length === 0 ? (
              <EmptyState
                title="No pages loaded"
                sub="Nothing on the loaded pages matches this filter or search."
                icon={<Icons.Globe size={20} />}
              />
            ) : (
              items.map((page) => (
                <PageRow
                  key={page.cleanupId}
                  item={page}
                  selected={selectedId === page.cleanupId}
                  onClick={() => onSelect(page.cleanupId)}
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

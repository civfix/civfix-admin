"use client"

import type { AdminEventPageListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { ListCard, ListStates, LoadMoreButton } from "@/components/shared/section-list"
import { PageRow } from "@/features/pages/page-row"
import type { useEventPageListInfinite } from "@/features/pages/use-pages"

export function PageListPane({
  listQuery,
  items,
  selectedId,
  onSelect,
}: {
  listQuery: ReturnType<typeof useEventPageListInfinite>
  items: AdminEventPageListItemDTO[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <ListCard
      title="Pages"
      meta={
        listQuery.isSuccess ? (
          <>
            {items.length}
            {listQuery.hasNextPage ? "+" : ""}
          </>
        ) : undefined
      }
    >
      <ListStates query={listQuery} loadingLabel="Loading pages...">
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
              onSelect={onSelect}
            />
          ))
        )}
        <LoadMoreButton query={listQuery} className="load-more" />
      </ListStates>
    </ListCard>
  )
}

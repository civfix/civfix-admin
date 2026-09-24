"use client"

import * as React from "react"
import type { AdminEventPageListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { SearchBox } from "@/components/shared/section-list"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { useDebounced } from "@/hooks/use-debounced"
import { useSelection } from "@/hooks/use-selection"
import { SEARCH_DEBOUNCE_MS } from "@/lib/timing"
import { flatPages } from "@/lib/infinite"
import {
  PAGE_FILTERS,
  pageListParams,
  pageRowFromDTO,
  type PageFilter,
} from "@/features/pages/pages-filters"
import { PageDetail } from "@/features/pages/page-detail"
import { PageListPane } from "@/features/pages/page-list-pane"
import { useEventPage, useEventPageListInfinite } from "@/features/pages/use-pages"
import type { SectionPageProps } from "@/components/shell/page-registry"

const PAGE_FILTER_LABEL: Record<PageFilter, string> = {
  all: "All",
  published: "Published",
  unpublished: "Unpublished",
  draft: "Draft",
  flagged: "Flagged",
}

const FILTER_OPTIONS = PAGE_FILTERS.map((value) => ({ value, label: PAGE_FILTER_LABEL[value] }))

const pageId = (item: AdminEventPageListItemDTO) => item.cleanupId

function PageDetailPane({
  selected,
  pageQuery,
  pageNoun,
}: {
  selected: AdminEventPageListItemDTO | null
  pageQuery: ReturnType<typeof useEventPage>
  pageNoun: string
}) {
  if (selected) return <PageDetail key={selected.cleanupId} item={selected} />
  if (pageQuery.isLoading) return <LoadingState label={`Loading ${pageNoun}...`} />
  if (pageQuery.isError) {
    return (
      <ErrorState
        error={pageQuery.error}
        onRetry={() => pageQuery.refetch()}
        title={`Could not load ${pageNoun}`}
      />
    )
  }
  return (
    <EmptyState
      title="No page selected"
      sub="Pick a page from the list."
      icon={<Icons.Globe size={20} />}
    />
  )
}

export function PagesPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<PageFilter>("published")
  const [query, setQuery] = React.useState("")

  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS)
  const listParams = React.useMemo(
    () => pageListParams(filter, debouncedQuery),
    [filter, debouncedQuery],
  )
  const listQuery = useEventPageListInfinite(listParams)
  const items = React.useMemo(
    () => flatPages(listQuery.data),
    [listQuery.data],
  )
  const { selectedId, setSelectedId, selectedItem: listed } = useSelection({
    focusId,
    list: listQuery,
    items,
    getId: pageId,
    listKey: JSON.stringify(listParams),
  })

  // The detail's preview reads the same key, so fetching before the list settles never doubles a request.
  const pageQuery = useEventPage(listed === null ? selectedId : null)
  const selected = listed ?? (pageQuery.data ? pageRowFromDTO(pageQuery.data) : null)
  const pageNoun = selectedId === focusId ? "the linked page" : "the page"

  return (
    <>
      <PageHead
        title="Signup pages"
        subtitle={
          <span>
            The public pages hosts publish for their events. Read what is actually on them, flag what
            needs a second look, and take a page off the web without touching the event.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(value) => setFilter(value as PageFilter)}
        />
        <div className="toolbar-spacer" />
        <SearchBox
          label="Search signup pages"
          placeholder="Search slug or title…"
          value={query}
          onChange={setQuery}
        />
      </div>

      <div className="master-detail">
        <PageListPane listQuery={listQuery} items={items} selectedId={selectedId} onSelect={setSelectedId} />

        <section className="card md-detail-card">
          <PageDetailPane selected={selected} pageQuery={pageQuery} pageNoun={pageNoun} />
        </section>
      </div>
    </>
  )
}

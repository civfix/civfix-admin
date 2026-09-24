"use client"

import * as React from "react"
import type { AdminEventPageListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { useDebounced } from "@/hooks/use-debounced"
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

// Only the first load picks a page on the operator's behalf, and a deep-linked page is never
// replaced. A pick that a filter or search leaves out stays open, read by id; a pick that drops out of
// the same list after a refetch (an unpublish under the Published chip) clears, so the moderation
// buttons never land on a page nobody chose. Decided only on data fetched for the current params.
function usePageSelection(
  focusId: string | null,
  listQuery: ReturnType<typeof useEventPageListInfinite>,
  items: AdminEventPageListItemDTO[],
  listKey: string,
) {
  const [selectedId, setSelectedId] = React.useState<string | null>(focusId)
  const [autoPick, setAutoPick] = React.useState(focusId === null)

  React.useEffect(() => {
    if (focusId) setSelectedId(focusId)
  }, [focusId])
  const seenIn = React.useRef<{ id: string; list: string } | null>(null)
  React.useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isFetching) return
    if (selectedId === null) {
      if (autoPick && items.length) setSelectedId(items[0]!.cleanupId)
      return
    }
    setAutoPick(false)
    if (items.some((item) => item.cleanupId === selectedId)) seenIn.current = { id: selectedId, list: listKey }
    else if (seenIn.current?.id === selectedId && seenIn.current.list === listKey) setSelectedId(null)
  }, [listQuery.isSuccess, listQuery.isFetching, items, selectedId, listKey, autoPick])

  return [selectedId, setSelectedId] as const
}

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
  const [selectedId, setSelectedId] = usePageSelection(focusId, listQuery, items, JSON.stringify(listParams))

  const listed = items.find((item) => item.cleanupId === selectedId) ?? null
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
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            aria-label="Search signup pages"
            placeholder="Search slug or title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
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

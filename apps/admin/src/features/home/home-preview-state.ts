import type { UseQueryResult } from "@tanstack/react-query"

export interface PreviewState {
  isLoading: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
  hasMore: boolean
  /** One source of a merged tile failed while the other loaded; its rows still show. */
  partialError?: { title: string; error: unknown; onRetry: () => void }
}

interface ListPage<T> {
  items: T[]
  nextCursor: string | null
}

type ListQuery<T> = UseQueryResult<ListPage<T>>

export function previewState<T>(query: ListQuery<T>, shown: number): PreviewState {
  return {
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    onRetry: () => {
      void query.refetch()
    },
    hasMore: query.data?.nextCursor != null || (query.data?.items.length ?? 0) > shown,
  }
}

function mailPartialError<O, I>(
  outreachQuery: ListQuery<O>,
  inboxQuery: ListQuery<I>,
): PreviewState["partialError"] {
  if (outreachQuery.isError && !inboxQuery.isError) {
    return {
      title: "Could not load outreach mail",
      error: outreachQuery.error,
      onRetry: () => void outreachQuery.refetch(),
    }
  }
  if (inboxQuery.isError && !outreachQuery.isError) {
    return {
      title: "Could not load the inbox",
      error: inboxQuery.error,
      onRetry: () => void inboxQuery.refetch(),
    }
  }
  return undefined
}

export function mailPreviewState<O, I>(
  outreachQuery: ListQuery<O>,
  inboxQuery: ListQuery<I>,
  shown: number,
): PreviewState {
  const loaded = (outreachQuery.data?.items.length ?? 0) + (inboxQuery.data?.items.length ?? 0)
  return {
    isLoading: outreachQuery.isLoading || inboxQuery.isLoading,
    isError: outreachQuery.isError && inboxQuery.isError,
    error: outreachQuery.error ?? inboxQuery.error,
    onRetry: () => {
      void outreachQuery.refetch()
      void inboxQuery.refetch()
    },
    hasMore:
      outreachQuery.data?.nextCursor != null || inboxQuery.data?.nextCursor != null || loaded > shown,
    partialError: mailPartialError(outreachQuery, inboxQuery),
  }
}

export interface TileNoun {
  one: string
  many: string
}

export function moreLabel(
  state: PreviewState,
  shown: number,
  noun: TileNoun,
  total?: number,
): string | null {
  if (state.isLoading || state.isError || shown === 0) return null
  if (total !== undefined) {
    const remaining = Math.max(0, total - shown)
    return remaining > 0 ? `… and ${remaining} more ${remaining === 1 ? noun.one : noun.many}` : null
  }
  return state.hasMore ? `… and more ${noun.many}` : null
}

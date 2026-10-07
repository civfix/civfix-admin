import { infiniteQueryOptions, type QueryKey } from "@tanstack/react-query"

export interface CursorPage {
  nextCursor?: string | null
}

/**
 * A cursor-paged list: the first page is fetched with `params` alone, each later page with the
 * previous page's `nextCursor` as `cursor`, and a null cursor ends the list.
 */
export function infiniteListOptions<
  TKey extends QueryKey,
  TParams extends object,
  TPage extends CursorPage,
>(
  queryKey: TKey,
  params: TParams,
  fetchPage: (input: TParams & { cursor?: string }) => Promise<TPage>,
) {
  return infiniteQueryOptions({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchPage({
        ...params,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function flatPages<T>(data: { pages: readonly { items: readonly T[] }[] } | undefined): T[] {
  return data?.pages.flatMap((p) => p.items) ?? []
}

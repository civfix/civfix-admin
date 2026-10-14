"use client"

import type * as React from "react"

import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"

export interface AnalyticsQuery<T> {
  isLoading: boolean
  isError: boolean
  error: unknown
  data: T | undefined
  refetch: () => void
}

function cardBody<T>(
  title: string,
  query: AnalyticsQuery<T>,
  isEmpty: ((data: T) => boolean) | undefined,
  children: (data: T) => React.ReactNode,
): React.ReactNode {
  if (query.isLoading) return <LoadingState label={`Loading ${title.toLowerCase()}...`} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (!query.data || (isEmpty && isEmpty(query.data))) {
    return <EmptyState title="No data yet" sub="Nothing to show for this window." />
  }
  return children(query.data)
}

export function AnalyticsCard<T>({
  title,
  meta,
  query,
  isEmpty,
  span2 = false,
  pad = true,
  children,
}: {
  title: string
  meta: string
  query: AnalyticsQuery<T>
  isEmpty?: (data: T) => boolean
  span2?: boolean
  pad?: boolean
  children: (data: T) => React.ReactNode
}) {
  const body = cardBody(title, query, isEmpty, children)
  return (
    <section className={`card ${span2 ? "span-2" : ""}`}>
      <div className="card-head">
        <h3>{title}</h3>
        <div className="spacer" />
        <span className="meta">{meta}</span>
      </div>
      {pad ? <div className="card-pad">{body}</div> : body}
    </section>
  )
}

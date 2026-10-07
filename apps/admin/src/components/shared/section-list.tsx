"use client"

import type * as React from "react"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"

export interface ListLoadState {
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: () => unknown
}

export interface NextPageState {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
}

export function SearchBox({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="searchbox">
      <Icons.Search size={14} />
      <input
        type="text"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function ListCard({
  title,
  meta,
  children,
}: {
  title: React.ReactNode
  meta?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="card md-list">
      <div className="card-head">
        <h3>{title}</h3>
        <div className="spacer" />
        {meta !== undefined && <span className="meta">{meta}</span>}
      </div>
      <div className="queue-list">{children}</div>
    </section>
  )
}

export function ListStates({
  query,
  loadingLabel,
  isEmpty = false,
  empty,
  children,
}: {
  query: ListLoadState
  loadingLabel: string
  isEmpty?: boolean
  empty?: React.ReactNode
  children: React.ReactNode
}) {
  if (query.isLoading) return <LoadingState label={loadingLabel} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (isEmpty) return empty
  return children
}

export function LoadMoreButton({
  query,
  className,
  label = "Load more",
}: {
  query: NextPageState
  className: "list-load-more" | "load-more"
  label?: string
}) {
  if (!query.hasNextPage) return null
  return (
    <button
      type="button"
      className={`btn ${className}`}
      disabled={query.isFetchingNextPage}
      onClick={() => void query.fetchNextPage()}
    >
      {query.isFetchingNextPage ? "Loading…" : label}
    </button>
  )
}

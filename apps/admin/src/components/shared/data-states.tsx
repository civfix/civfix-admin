"use client"

import * as React from "react"

import { toAppError } from "@/lib/api"

/**
 * Standard loading / error / empty state components for data-bound views. The prototype had NONE of
 * these (data was synchronous from window.DATA); every real list/detail needs them. The section pages
 * use these so the conventions stay consistent across sections.
 *
 * Recommended pattern in a page/section:
 *
 *   const q = useSomething(params)
 *   if (q.isLoading) return <LoadingState label="Loading reports..." />
 *   if (q.isError)   return <ErrorState error={q.error} onRetry={() => q.refetch()} />
 *   if (!q.data?.items.length) return <EmptyState title="Nothing here" sub="..." />
 *   // ...render q.data
 */

/** Centered spinner row for in-flight queries. */
export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="state-loading" role="status" aria-live="polite">
      <span className="op-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

/**
 * Error panel with an optional retry. Surfaces the normalized AppError message; when the backend is
 * down this renders the friendly INTERNAL message rather than crashing.
 */
export function ErrorState({
  error,
  onRetry,
  title = "Could not load this",
}: {
  error: unknown
  onRetry?: () => void
  title?: string
}) {
  const message = React.useMemo(() => toAppError(error).message, [error])
  return (
    <div className="state-error" role="alert">
      <div className="state-error-title">{title}</div>
      <div className="state-error-sub">{message}</div>
      {onRetry && (
        <button type="button" className="btn sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

/** A simple skeleton block; size it with width/height. Use several to fake a loading list/card. */
export function Skeleton({
  width = "100%",
  height = 16,
  radius = 8,
  className = "",
}: {
  width?: number | string
  height?: number | string
  radius?: number
  className?: string
}) {
  return (
    <div
      className={`skel ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}

"use client"

import * as React from "react"

import { errorMessage } from "@/lib/error-messages"

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
 * Error panel with an optional retry and an optional primary action beside it (the error boundary's
 * Reload). Shows the error's operator copy from errorMessage unless `message` replaces it.
 */
export function ErrorState({
  error,
  onRetry,
  title = "Could not load this",
  message,
  action,
}: {
  error: unknown
  onRetry?: () => void
  title?: string
  message?: string
  action?: { label: string; onClick: () => void }
}) {
  const errorText = React.useMemo(() => errorMessage(error), [error])
  const retry = onRetry && (
    <button type="button" className="btn sm" onClick={onRetry}>
      Try again
    </button>
  )
  return (
    <div className="state-error" role="alert">
      <div className="state-error-title">{title}</div>
      <div className="state-error-sub">{message ?? errorText}</div>
      {action ? (
        <div className="row-flex">
          {retry}
          <button type="button" className="btn sm primary" onClick={action.onClick}>
            {action.label}
          </button>
        </div>
      ) : (
        retry
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

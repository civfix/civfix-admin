"use client"

import * as React from "react"

import { errorMessage } from "@/lib/error-messages"

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="state-loading" role="status" aria-live="polite">
      <span className="op-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

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

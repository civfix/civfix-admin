"use client"

import * as React from "react"

import { ErrorState } from "@/components/shared/data-states"
import { isAppError } from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"

const CHUNK_LOAD_MESSAGE =
  /Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === "ChunkLoadError" || CHUNK_LOAD_MESSAGE.test(error.message)
}

const RENDER_FAILED = "This page hit an unexpected error. Try again, or reload the dashboard."

function reloadPage(): void {
  window.location.reload()
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  reload?: () => void
}

type ErrorBoundaryState = { failed: false } | { failed: true; error: unknown }

// No componentDidCatch: Next's app-router onCaughtError already console.errors every error an explicit
// boundary catches, so logging here would report each one twice.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { failed: true, error }
  }

  private retry = () => this.setState({ failed: false })

  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <BoundaryFallback
        error={this.state.error}
        onRetry={this.retry}
        onReload={this.props.reload ?? reloadPage}
      />
    )
  }
}

function BoundaryFallback({
  error,
  onRetry,
  onReload,
}: {
  error: unknown
  onRetry: () => void
  onReload: () => void
}) {
  // React.lazy caches a rejected import, so remounting re-throws the same chunk failure; only a full
  // reload fetches the new build's chunk manifest.
  const chunkFailed = isChunkLoadError(error)
  // A developer exception's text (a TypeError naming a property) means nothing to an operator; only an
  // AppError carries copy written for them.
  const message = chunkFailed
    ? "The dashboard may have been updated. Reload to get the latest version."
    : errorMessage(error, {}, { fallback: RENDER_FAILED, preferServerMessage: isAppError(error) })
  return (
    <ErrorState
      error={error}
      title={chunkFailed ? "This page could not load" : "Something went wrong"}
      message={message}
      onRetry={chunkFailed ? undefined : onRetry}
      action={{ label: "Reload", onClick: onReload }}
    />
  )
}

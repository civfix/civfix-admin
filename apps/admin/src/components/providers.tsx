"use client"

import * as React from "react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"

import { makeQueryClient } from "@/lib/query"
import { AuthHydrator } from "@/components/auth/auth-hydrator"
import { ErrorBoundary } from "@/components/shell/error-boundary"
import { OperatorLogin } from "@/features/auth/operator-login"
import { useOperatorSession } from "@/hooks/use-admin-auth"

/**
 * App-wide client providers. Mounted once in the root layout.
 *
 * The QueryClient is created lazily and held in a ref so it survives re-renders but is unique per
 * browser tab. AuthHydrator runs the Cloudflare Access exchange/bootstrap on mount; AuthGate then
 * decides whether to render the dashboard, the loading screen, or the operator (Access) gate.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const clientRef = React.useRef<QueryClient | null>(null)
  if (!clientRef.current) {
    clientRef.current = makeQueryClient()
  }

  return (
    <QueryClientProvider client={clientRef.current}>
      <ErrorBoundary>
        <AuthHydrator />
        <AuthGate>{children}</AuthGate>
      </ErrorBoundary>
    </QueryClientProvider>
  )
}

/**
 * The operator gate. Only an authenticated operator session renders the dashboard:
 *  - idle / loading  -> a minimal loading screen (Access exchange in flight, or pre-hydration).
 *  - signing-out     -> the same screen, saying so, until the Access logout navigation lands.
 *  - not an operator -> the full-page Cloudflare Access gate (anonymous: authenticating + manual
 *                       continue; forbidden: not-authorized message).
 *  - operator        -> the dashboard shell (children).
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isOperator, status } = useOperatorSession()

  if (status === "idle" || status === "loading") {
    return <BootScreen label="Loading operations..." />
  }

  if (status === "signing-out") {
    return <BootScreen label="Signing out..." />
  }

  if (!isOperator) {
    return <OperatorLogin />
  }

  return <>{children}</>
}

/** Minimal centered screen shown while the session is being established or ended. */
function BootScreen({ label }: { label: string }) {
  return (
    <div className="op-boot" role="status" aria-live="polite">
      <span className="op-boot-bug" aria-hidden="true">
        {/* Tiny static brand SVG: <img> is appropriate (static export, images.unoptimized). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ds/pinit-bug.svg" alt="" width={30} height={36} />
      </span>
      <span className="op-boot-spin" aria-hidden="true" />
      <span className="op-boot-text">{label}</span>
    </div>
  )
}

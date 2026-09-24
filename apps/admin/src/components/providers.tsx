"use client"

import * as React from "react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"

import { makeQueryClient } from "@/lib/query"
import { AuthHydrator } from "@/components/auth/auth-hydrator"
import { BrandBug } from "@/components/shared/brand-bug"
import { ErrorBoundary } from "@/components/shell/error-boundary"
import { OperatorLogin } from "@/features/auth/operator-login"
import { useOperatorSession } from "@/hooks/use-admin-auth"

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

function BootScreen({ label }: { label: string }) {
  return (
    <div className="op-boot" role="status" aria-live="polite">
      <span className="op-boot-bug" aria-hidden="true">
        <BrandBug width={30} height={36} />
      </span>
      <span className="op-boot-spin" aria-hidden="true" />
      <span className="op-boot-text">{label}</span>
    </div>
  )
}

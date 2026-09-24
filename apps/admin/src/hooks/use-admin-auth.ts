"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  ErrorCode,
  type AdminLoginResponse,
  type AdminOperatorDTO,
  type AdminSessionResponse,
} from "@civfix/shared"

import { api, toAppError } from "@/lib/api"
import { navigateToAccessLogout } from "@/lib/access-auth"
import { useAuthStore, selectIsOperator, selectOperator } from "@/store/auth-store"

// Cloudflare Access authenticates operators; the SPA never collects credentials. The SPA and the
// `/admin/*` API sit behind the same Access app on the same origin, so a credentialed same-origin
// request carries the Access cookie and the edge injects the JWT the exchange verifies.

export function useOperatorSession() {
  const isOperator = useAuthStore(selectIsOperator)
  const operator = useAuthStore(selectOperator)
  const status = useAuthStore((s) => s.status)
  return { isOperator, operator, status }
}

function operatorFromLogin(res: AdminLoginResponse): AdminOperatorDTO {
  return {
    id: res.user.id,
    name: res.user.displayName,
    email: res.user.email ?? "",
    role: res.user.role,
  }
}

/**
 * "forbidden": Access authenticated the user but they are not an allowlisted operator. Terminal, since a
 * retry would get the same answer. "error": the exchange failed for any other reason and may be retried.
 */
export type BootstrapOutcome = "ok" | "forbidden" | "error"

// A non-operator would pass the gate's session check yet fail selectIsOperator, so storing it would
// send the gate's Try again straight back to the same session.
function adopt(operator: AdminOperatorDTO, csrfToken: string | undefined): BootstrapOutcome {
  const store = useAuthStore.getState()
  if (operator.role !== "operator") {
    store.clear("forbidden")
    return "forbidden"
  }
  store.setSession({ operator, csrfToken })
  return "ok"
}

async function reusableSession(): Promise<AdminSessionResponse | null> {
  try {
    return await api.adminSession()
  } catch {
    // A failed check (expired, transient, network) only means there is nothing to reuse; the
    // exchange below decides the outcome.
    return null
  }
}

async function establishOperatorSession(): Promise<BootstrapOutcome> {
  useAuthStore.getState().setStatus("loading")

  const session = await reusableSession()
  if (session?.authenticated && session.operator) return adopt(session.operator, session.csrfToken)

  try {
    const res = await api.adminAccessExchange()
    return adopt(operatorFromLogin(res), res.csrfToken)
  } catch (err) {
    // A clean 403 means Access authenticated the user but they are not on the operator allowlist.
    if (toAppError(err).code === ErrorCode.FORBIDDEN) {
      useAuthStore.getState().clear("forbidden")
      return "forbidden"
    }
    useAuthStore.getState().clear()
    return "error"
  }
}

// React StrictMode runs the hydrator's effect twice and Try again can be pressed mid-attempt; every
// exchange mints a session and writes an operator.login audit row, so overlapping callers share one.
let inflight: Promise<BootstrapOutcome> | null = null

function bootstrapOperatorSession(): Promise<BootstrapOutcome> {
  inflight ??= establishOperatorSession().finally(() => {
    inflight = null
  })
  return inflight
}

/**
 * Never throws. A still-valid session is reused before exchanging, so a full-page reload does not mint
 * a new session or write another operator.login audit row.
 */
export function useOperatorBootstrap(): () => Promise<BootstrapOutcome> {
  return bootstrapOperatorSession
}

/**
 * Ends the Access session too, or the next visit silently re-authenticates from the still-valid Access
 * cookie. The status turns signing-out first so the gate shows neither the dashboard nor the
 * session-error screen while the request and navigation run.
 */
export function useAdminLogout(): () => Promise<void> {
  const setStatus = useAuthStore((s) => s.setStatus)
  const clear = useAuthStore((s) => s.clear)
  const queryClient = useQueryClient()

  return React.useCallback(async () => {
    setStatus("signing-out")
    try {
      await api.adminLogout()
    } catch {
      // A failed revoke (already expired, backend down) must not keep this tab signed in; the Access
      // logout below still ends the SSO session.
    }
    clear("signing-out")
    // A future operator on this tab must not see the previous one's data.
    queryClient.clear()
    navigateToAccessLogout()
  }, [setStatus, clear, queryClient])
}

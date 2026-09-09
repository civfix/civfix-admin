"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ErrorCode, type AdminLoginResponse } from "@civfix/shared"

import { api, toAppError } from "@/lib/api"
import { navigateToAccessLogout } from "@/lib/access-auth"
import { useAuthStore, selectIsOperator, selectOperator } from "@/store/auth-store"

/**
 * Operator auth hooks for the dashboard.
 *
 * Auth model (Cloudflare Access SSO, doc 16; same-origin deployment): authentication is delegated to
 * Cloudflare Access. The SPA does not collect credentials; the SPA and the `/admin/*` API sit behind the
 * same Access app on the same origin, so a credentialed same-origin request already carries the Access
 * cookie and the edge injects the JWT. The bootstrap:
 *  - reuse:    GET  /admin/auth/session       -> { authenticated, operator?, csrfToken? } (adopt if valid)
 *  - exchange: POST /admin/auth/access/exchange (no body) -> { user (operator), csrfToken }
 *  - logout:   POST /admin/auth/logout, then GET /cdn-cgi/access/logout to end the Access session.
 *
 * The CSRF token returned by the exchange/session response is echoed on mutations via x-csrf-token.
 */

/** Read-side: is there an authenticated operator session right now? */
export function useOperatorSession() {
  const isOperator = useAuthStore(selectIsOperator)
  const operator = useAuthStore(selectOperator)
  const status = useAuthStore((s) => s.status)
  return { isOperator, operator, status }
}

/** Map the AdminLoginResponse `user` (Phase-1 SessionResponse shape) onto the operator DTO the store holds. */
function operatorFromLogin(res: AdminLoginResponse) {
  return {
    id: res.user.id,
    name: res.user.displayName,
    email: res.user.email ?? "",
    role: res.user.role,
  }
}

/**
 * Outcome of an operator bootstrap attempt:
 *  - "ok":        an operator session is established (reused or freshly minted); the gate unmounts.
 *  - "forbidden": Access authenticated the user but the email is not on the operator allowlist (a clean
 *                 403). Terminal - show the not-authorized message.
 *  - "error":     the exchange could not be completed (Access misconfigured / backend unreachable /
 *                 transient). The login screen offers a retry.
 */
export type BootstrapOutcome = "ok" | "forbidden" | "error"

/**
 * Establish the operator session and update the auth store. Returns a callback resolving to a
 * {@link BootstrapOutcome}. Used by the AuthHydrator on mount and by the login screen's retry button.
 * Never throws.
 *
 * It first tries to REUSE a still-valid operator session (GET /admin/auth/session) so a full-page reload
 * does not re-mint a session / write a fresh operator.login audit row. If there is none, it exchanges the
 * Access JWT (POST /admin/auth/access/exchange) for one.
 */
export function useOperatorBootstrap(): () => Promise<BootstrapOutcome> {
  const setSession = useAuthStore((s) => s.setSession)
  const setStatus = useAuthStore((s) => s.setStatus)

  return React.useCallback(async () => {
    setStatus("loading")

    // 1. Reuse an existing valid operator session (no re-mint, no audit churn on reload).
    try {
      const session = await api.adminSession()
      if (session.authenticated && session.operator) {
        setSession({ operator: session.operator, csrfToken: session.csrfToken })
        return "ok"
      }
    } catch {
      // Session check failed (transient) — fall through to the exchange.
    }

    // 2. No reusable session — exchange the Access JWT (injected by the edge on this same-origin request).
    try {
      const res = await api.adminAccessExchange()
      setSession({ operator: operatorFromLogin(res), csrfToken: res.csrfToken })
      return "ok"
    } catch (err) {
      // A clean 403 means Access authenticated the user but they are not on the operator allowlist.
      if (toAppError(err).code === ErrorCode.FORBIDDEN) {
        setStatus("forbidden")
        return "forbidden"
      }
      // Anything else (Access not configured / backend down / network) is a retryable error.
      setStatus("anonymous")
      return "error"
    }
  }, [setSession, setStatus])
}

/**
 * Sign the operator out: POST /admin/auth/logout (CSRF-protected), clear local state + cache, then end
 * the Cloudflare Access session by navigating to /cdn-cgi/access/logout (doc 16 sec 6.5) - otherwise the
 * next visit silently re-authenticates from the still-valid Access cookie.
 */
export function useAdminLogout(): () => Promise<void> {
  const clear = useAuthStore((s) => s.clear)
  const queryClient = useQueryClient()

  return React.useCallback(async () => {
    try {
      await api.adminLogout()
    } catch {
      // Even if the call fails (already expired, backend down), drop local state.
    }
    clear()
    // Drop all admin data so a future operator does not see stale cache.
    queryClient.clear()
    // End the Access session and leave the page; this navigation does not return here.
    navigateToAccessLogout()
  }, [clear, queryClient])
}

"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { AdminOtpRequestResponse, AdminLoginResponse } from "@civfix/shared"

import { api } from "@/lib/api"
import { useAuthStore, selectIsOperator, selectOperator } from "@/store/auth-store"

/**
 * Operator auth hooks for the dashboard.
 *
 * Session model (web cookie + CSRF), mirroring community-web:
 *  - request: POST /admin/auth/otp/request { email }  -> { sent, resendAfterSec }
 *  - verify:  POST /admin/auth/otp/verify  { email, code } -> { user (operator), csrfToken }
 *  - session: GET  /admin/auth/session     -> { authenticated, operator?, csrfToken? }
 *  - logout:  POST /admin/auth/logout
 *
 * On verify we capture the operator identity + CSRF token immediately (so the next mutation can echo
 * x-csrf-token), then call refreshSession() to confirm the role from the canonical session endpoint.
 */

/** Read-side: is there an authenticated operator session right now? */
export function useOperatorSession() {
  const isOperator = useAuthStore(selectIsOperator)
  const operator = useAuthStore(selectOperator)
  const status = useAuthStore((s) => s.status)
  return { isOperator, operator, status }
}

/**
 * Refresh the auth store from GET /admin/auth/session. Returns a callback that resolves to true when an
 * operator session is established. Resilient: a network error or unauthenticated response leaves the
 * app in the signed-out (login gate) state rather than throwing.
 */
export function useRefreshSession(): () => Promise<boolean> {
  const setSession = useAuthStore((s) => s.setSession)
  const setStatus = useAuthStore((s) => s.setStatus)

  return React.useCallback(async () => {
    setStatus("loading")
    try {
      const res = await api.adminSession()
      if (res.authenticated && res.operator) {
        setSession({ operator: res.operator, csrfToken: res.csrfToken })
        return res.operator.role === "operator"
      }
      setSession({ operator: null })
      return false
    } catch {
      setStatus("anonymous")
      return false
    }
  }, [setSession, setStatus])
}

/** Request an OTP code for the given email. The response is intentionally identical whether or not the
 * email is allowlisted (no enumeration); the UI just advances to the code step. */
export function useRequestAdminOtp() {
  return useMutation<AdminOtpRequestResponse, unknown, { email: string }>({
    mutationFn: (input) => api.adminLogin(input),
  })
}

/**
 * Verify the 6-digit code. On success captures the operator + CSRF token into the store immediately.
 * Callers should then call refreshSession() to confirm the operator role before rendering the app.
 */
export function useVerifyAdminOtp() {
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation<AdminLoginResponse, unknown, { email: string; code: string }>({
    mutationFn: (input) => api.adminVerifyOtp(input),
    onSuccess: (res) => {
      // The verify response reuses the Phase 1 SessionResponse: { user: {id,name?,email,role}, csrfToken }.
      // Map it onto the operator DTO shape the store holds.
      setSession({
        operator: {
          id: res.user.id,
          name: res.user.displayName,
          email: res.user.email ?? "",
          role: res.user.role,
        },
        csrfToken: res.csrfToken,
      })
    },
  })
}

/** Sign the operator out: POST /admin/auth/logout (CSRF-protected), then clear local state and cache. */
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
  }, [clear, queryClient])
}

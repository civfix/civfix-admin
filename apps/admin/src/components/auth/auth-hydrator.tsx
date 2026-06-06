"use client"

import * as React from "react"

import { api } from "@/lib/api"
import { useAuthStore } from "@/store/auth-store"

/**
 * Hydrates the operator auth store from GET /admin/auth/session exactly once on mount.
 *
 * Resilient by design: if the backend is unreachable (dev / no server), the catch sets the status to
 * "anonymous" so the app renders the login gate instead of spinning forever. The session endpoint
 * returns `authenticated:false` for the normal signed-out path.
 */
export function AuthHydrator() {
  const setSession = useAuthStore((s) => s.setSession)
  const setStatus = useAuthStore((s) => s.setStatus)

  React.useEffect(() => {
    let cancelled = false
    setStatus("loading")

    api
      .adminSession()
      .then((res) => {
        if (cancelled) return
        if (res.authenticated && res.operator) {
          // Thread the CSRF token from the session check so a page reload recovers it for mutations.
          setSession({ operator: res.operator, csrfToken: res.csrfToken })
        } else {
          setSession({ operator: null })
        }
      })
      .catch(() => {
        if (cancelled) return
        // Backend down or network error: treat as signed-out, do not block the UI.
        setStatus("anonymous")
      })

    return () => {
      cancelled = true
    }
  }, [setSession, setStatus])

  return null
}

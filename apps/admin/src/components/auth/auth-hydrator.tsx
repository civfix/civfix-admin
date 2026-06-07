"use client"

import * as React from "react"

import { useOperatorBootstrap } from "@/hooks/use-admin-auth"

/**
 * Bootstraps the operator session via Cloudflare Access exactly once on mount (doc 16, same-origin).
 *
 * The SPA and the `/admin/*` API are served behind the same Access app on the same origin, so by the time
 * this runs the browser already holds the Access cookie. The bootstrap (useOperatorBootstrap) first reuses
 * a still-valid operator session (GET /admin/auth/session), and otherwise exchanges the edge-injected
 * Access JWT (POST /admin/auth/access/exchange) for one. On success the auth store flips to authenticated
 * and the gate (providers.tsx) renders the dashboard; a 403 (authenticated but not allowlisted) lands on
 * the not-authorized state; any other failure lands on the retryable login screen. No cross-origin cookie
 * bootstrap / redirect is needed in this same-origin deployment.
 */
export function AuthHydrator() {
  const bootstrap = useOperatorBootstrap()

  React.useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return null
}

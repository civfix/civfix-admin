"use client"

import { API_BASE_URL } from "@/lib/api"

/**
 * Cloudflare Access helpers for the operator dashboard (doc 16, same-origin deployment).
 *
 * Auth model: admin authentication is delegated to Cloudflare Access (Zero Trust SSO). The SPA and the
 * `/admin/*` API are served behind the SAME Access app and the SAME origin (admin.civfix.org → Caddy
 * serves the SPA and routes `/admin/*` to the backend). So by the time the SPA loads, the browser already
 * holds the Access cookie for this origin, and a credentialed same-origin `POST /admin/auth/access/exchange`
 * carries it — Cloudflare injects the verified `Cf-Access-Jwt-Assertion` header at the edge and the
 * backend mints the operator session. No cross-origin cookie bootstrap is needed.
 */

/**
 * End the Cloudflare Access session (doc 16 sec 6.5). After the app session is revoked via
 * `POST /admin/auth/logout`, navigate the browser to `/cdn-cgi/access/logout`; otherwise the next visit
 * silently re-authenticates from the still-valid Access cookie. Full-page navigation, server-safe.
 */
export function navigateToAccessLogout(): void {
  if (typeof window === "undefined") return
  window.location.assign(`${API_BASE_URL}/cdn-cgi/access/logout`)
}

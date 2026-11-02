"use client"

import { API_BASE_URL } from "@/lib/api"

const ACCESS_LOGOUT_PATH = "/cdn-cgi/access/logout"

// Revoking the app session alone is not enough: until Access's own logout runs, the next visit
// silently re-authenticates from the still-valid Access cookie.
export function navigateToAccessLogout(): void {
  if (typeof window === "undefined") return
  // Cloudflare's own logout endpoint, not a Next.js page: only a full page load reaches it.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${API_BASE_URL}${ACCESS_LOGOUT_PATH}`)
}

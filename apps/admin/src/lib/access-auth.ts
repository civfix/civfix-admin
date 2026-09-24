"use client"

import { API_BASE_URL } from "@/lib/api"

const ACCESS_LOGOUT_PATH = "/cdn-cgi/access/logout"

// Revoking the app session alone is not enough: until Access's own logout runs, the next visit
// silently re-authenticates from the still-valid Access cookie.
export function navigateToAccessLogout(): void {
  if (typeof window === "undefined") return
  window.location.assign(`${API_BASE_URL}${ACCESS_LOGOUT_PATH}`)
}

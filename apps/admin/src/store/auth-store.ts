"use client"

import { create } from "zustand"
import type { AdminOperatorDTO } from "@civfix/shared"

/**
 * Operator authentication state for the admin dashboard.
 *
 * Web uses cookie sessions: the session cookie is httpOnly and set by the API, so we never see the
 * token here. What we DO track is the CSRF token (returned by the POST /admin/auth/access/exchange
 * response and GET /admin/auth/session) which must be echoed on mutating requests via the x-csrf-token
 * header, plus the operator identity rendered across the shell.
 *
 * The API client (src/lib/api.ts) reads the current csrfToken through getCsrfToken() at call time, so
 * there is no static import cycle between the store and the client.
 */

/**
 * - idle/loading: pre-hydration or the Access exchange is in flight (show the boot/authenticating gate).
 * - authenticated: an operator session is established.
 * - anonymous: no session yet; the Access bootstrap can be (re)attempted via a top-level navigation.
 * - forbidden: Cloudflare Access authenticated the user but their email is NOT on the operator
 *   allowlist (a clean 403). This is a terminal state - retrying the bootstrap would loop, so the gate
 *   shows a "not authorized" message instead of redirecting.
 * - signing-out: the operator chose Sign out and the page is about to leave for the Access logout.
 */
export type AuthStatus = "idle" | "loading" | "authenticated" | "anonymous" | "forbidden" | "signing-out"

export type SignedOutStatus = Extract<AuthStatus, "anonymous" | "forbidden" | "signing-out">

export interface AuthState {
  status: AuthStatus
  /** The signed-in operator ({ id, name, email, role }), or null when not authenticated. */
  operator: AdminOperatorDTO | null
  csrfToken: string | null

  setSession: (input: { operator: AdminOperatorDTO | null; csrfToken?: string | null }) => void
  setStatus: (status: AuthStatus) => void
  /** Drop the identity and CSRF token, landing in `status` (anonymous unless given). */
  clear: (status?: SignedOutStatus) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "idle",
  operator: null,
  csrfToken: null,

  setSession: ({ operator, csrfToken }) =>
    set((prev) => ({
      operator,
      // Preserve an existing CSRF token if a refresh did not return a new one.
      csrfToken: csrfToken !== undefined ? csrfToken : prev.csrfToken,
      status: operator ? "authenticated" : "anonymous",
    })),

  setStatus: (status) => set({ status }),

  // Signing out is one-way: a 401 answering a request still in flight must not bring back the
  // sign-in screen while the page leaves.
  clear: (status = "anonymous") =>
    set((prev) => ({
      status: prev.status === "signing-out" ? "signing-out" : status,
      operator: null,
      csrfToken: null,
    })),
}))

/**
 * Non-hook accessor for the current CSRF token. Used by the API client (which lives outside React) to
 * inject the x-csrf-token header on mutations without subscribing to the store.
 */
export function getCsrfToken(): string | undefined {
  return useAuthStore.getState().csrfToken ?? undefined
}

/** True only when an operator session is established and the role is actually `operator`. */
export const selectIsOperator = (s: AuthState): boolean =>
  s.status === "authenticated" && s.operator?.role === "operator"

/** Convenience selector for the operator identity. */
export const selectOperator = (s: AuthState): AdminOperatorDTO | null => s.operator

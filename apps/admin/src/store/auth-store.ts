"use client"

import { create } from "zustand"
import type { AdminOperatorDTO } from "@civfix/shared"

// The session cookie is httpOnly, so the store never holds the session token; it holds only the CSRF
// token mutations must echo, and the operator identity.

/**
 * "forbidden" is terminal: Access authenticated the user but they are not an allowlisted operator, so
 * retrying the bootstrap would only loop.
 */
type AuthStatus = "idle" | "loading" | "authenticated" | "anonymous" | "forbidden" | "signing-out"

type SignedOutStatus = Extract<AuthStatus, "anonymous" | "forbidden" | "signing-out">

export interface AuthState {
  status: AuthStatus
  operator: AdminOperatorDTO | null
  csrfToken: string | null

  setSession: (input: { operator: AdminOperatorDTO | null; csrfToken?: string | null }) => void
  setStatus: (status: AuthStatus) => void
  clear: (status?: SignedOutStatus) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "idle",
  operator: null,
  csrfToken: null,

  setSession: ({ operator, csrfToken }) =>
    set((prev) => ({
      operator,
      // A session refresh that returns no CSRF token keeps the current one.
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

// A non-hook accessor, read at call time, keeps the API client free of a static import cycle with
// this store.
export function getCsrfToken(): string | undefined {
  return useAuthStore.getState().csrfToken ?? undefined
}

export const selectIsOperator = (s: AuthState): boolean =>
  s.status === "authenticated" && s.operator?.role === "operator"

export const selectOperator = (s: AuthState): AdminOperatorDTO | null => s.operator

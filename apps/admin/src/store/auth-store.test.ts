import { afterEach, describe, expect, it } from "vitest"
import type { AdminOperatorDTO } from "@civfix/shared"

import { getCsrfToken, selectIsOperator, useAuthStore, type AuthState } from "./auth-store"

const OPERATOR: AdminOperatorDTO = { id: "op-1", name: "Ada Ops", email: "ada@civfix.org", role: "operator" }

function signedIn(): void {
  useAuthStore.setState({ status: "authenticated", operator: OPERATOR, csrfToken: "csrf-1" })
}

afterEach(() => {
  useAuthStore.setState({ status: "idle", operator: null, csrfToken: null })
})

describe("auth store", () => {
  it("keeps the stored CSRF token when a session update omits one", () => {
    signedIn()
    useAuthStore.getState().setSession({ operator: OPERATOR })
    expect(getCsrfToken()).toBe("csrf-1")
    useAuthStore.getState().setSession({ operator: OPERATOR, csrfToken: null })
    expect(getCsrfToken()).toBeUndefined()
  })

  it("clears the identity into the anonymous state by default", () => {
    signedIn()
    useAuthStore.getState().clear()
    expect(useAuthStore.getState()).toMatchObject({ status: "anonymous", operator: null, csrfToken: null })
  })

  it.each(["forbidden", "signing-out"] as const)("clears the identity into the %s state", (status) => {
    signedIn()
    useAuthStore.getState().clear(status)
    expect(useAuthStore.getState()).toMatchObject({ status, operator: null, csrfToken: null })
  })

  it("stays signing-out when a late 401 clears the session during sign-out", () => {
    signedIn()
    useAuthStore.getState().setStatus("signing-out")
    useAuthStore.getState().clear()
    expect(useAuthStore.getState()).toMatchObject({ status: "signing-out", operator: null, csrfToken: null })
  })

  it.each<[string, Partial<AuthState>, boolean]>([
    ["an authenticated operator", { status: "authenticated", operator: OPERATOR }, true],
    ["an authenticated non-operator", { status: "authenticated", operator: { ...OPERATOR, role: "citizen" } }, false],
    ["an operator while signing out", { status: "signing-out", operator: OPERATOR }, false],
    ["no operator", { status: "authenticated", operator: null }, false],
  ])("selectIsOperator is right for %s", (_label, state, expected) => {
    useAuthStore.setState(state)
    expect(selectIsOperator(useAuthStore.getState())).toBe(expected)
  })
})

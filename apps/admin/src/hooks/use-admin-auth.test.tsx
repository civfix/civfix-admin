import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { AppError, ErrorCode, type AdminLoginResponse, type AdminOperatorDTO } from "@civfix/shared"

import { apiMock } from "@/test/api-mock"
import { makeTestQueryClient } from "@/test/render"
import { API_BASE_URL, getApiClient } from "@/lib/api"
import type * as ApiModule from "@/lib/api"
import { useAuthStore } from "@/store/auth-store"
import { useOperatorLogout, useOperatorBootstrap, useOperatorSession } from "./use-admin-auth"

// The real client binds window.fetch when @/lib/api first evaluates, so the stub must exist before
// that import for getApiClient() to route through it; the bound mock outlives the afterEach unstub.
const { fetchMock } = vi.hoisted(() => {
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal("fetch", fetchMock)
  return { fetchMock }
})

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const OPERATOR: AdminOperatorDTO = { id: "op-1", name: "Ada Ops", email: "ada@civfix.org", role: "operator" }

function loginResponse(user: Partial<AdminLoginResponse["user"]> = {}, csrfToken?: string): AdminLoginResponse {
  return {
    user: {
      id: "op-2",
      displayName: "Grace Ops",
      email: "grace@civfix.org",
      role: "operator",
      locale: "en",
      createdAt: "2026-01-01T00:00:00.000Z",
      ...user,
    },
    ...(csrfToken !== undefined ? { csrfToken } : {}),
  }
}

function foreignAppError(code: ErrorCode, message = code): Error {
  const err = new Error(message) as Error & { code: ErrorCode; httpStatus: number }
  err.name = "AppError"
  err.code = code
  err.httpStatus = code === ErrorCode.FORBIDDEN ? 403 : 500
  return err
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function renderBootstrap() {
  return renderHook(() => useOperatorBootstrap(), { wrapper: wrapperFor(makeTestQueryClient()) })
}

async function bootstrap(): Promise<string> {
  const { result } = renderBootstrap()
  let outcome = ""
  await act(async () => {
    outcome = await result.current()
  })
  return outcome
}

function resetAuthStore(): void {
  useAuthStore.setState({ status: "idle", operator: null, csrfToken: null })
}

beforeEach(() => {
  resetAuthStore()
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useOperatorBootstrap: session reuse", () => {
  it("adopts a valid session without calling the exchange", async () => {
    apiMock.adminSession.mockResolvedValue({ authenticated: true, operator: OPERATOR, csrfToken: "csrf-s" })
    expect(await bootstrap()).toBe("ok")
    expect(apiMock.adminAccessExchange).not.toHaveBeenCalled()
    expect(useAuthStore.getState()).toMatchObject({
      status: "authenticated",
      operator: OPERATOR,
      csrfToken: "csrf-s",
    })
  })

  it("keeps a previously stored CSRF token when the session omits one", async () => {
    useAuthStore.setState({ csrfToken: "csrf-old" })
    apiMock.adminSession.mockResolvedValue({ authenticated: true, operator: OPERATOR })
    expect(await bootstrap()).toBe("ok")
    expect(useAuthStore.getState().csrfToken).toBe("csrf-old")
  })

  it("refuses a non-operator session as forbidden instead of storing it", async () => {
    const citizen: AdminOperatorDTO = { ...OPERATOR, role: "citizen" }
    apiMock.adminSession.mockResolvedValue({ authenticated: true, operator: citizen, csrfToken: "c" })
    const client = makeTestQueryClient()
    const boot = renderHook(() => useOperatorBootstrap(), { wrapper: wrapperFor(client) })
    let outcome = ""
    await act(async () => {
      outcome = await boot.result.current()
    })
    expect(outcome).toBe("forbidden")
    expect(apiMock.adminAccessExchange).not.toHaveBeenCalled()
    const session = renderHook(() => useOperatorSession(), { wrapper: wrapperFor(client) })
    expect(session.result.current).toEqual({ isOperator: false, operator: null, status: "forbidden" })
    expect(useAuthStore.getState().csrfToken).toBeNull()
  })

  it("sets status to loading while the session check is in flight", async () => {
    let resolveSession: (value: unknown) => void = () => undefined
    apiMock.adminSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve
      }),
    )
    const { result } = renderBootstrap()
    let pending: Promise<string> = Promise.resolve("")
    act(() => {
      pending = result.current()
    })
    expect(useAuthStore.getState().status).toBe("loading")
    await act(async () => {
      resolveSession({ authenticated: true, operator: OPERATOR, csrfToken: "c" })
      await pending
    })
    expect(useAuthStore.getState().status).toBe("authenticated")
  })

  it.each([
    ["unauthenticated", { authenticated: false }],
    ["authenticated without an operator", { authenticated: true }],
  ])("falls through to the exchange when the session is %s", async (_label, session) => {
    apiMock.adminSession.mockResolvedValue(session)
    apiMock.adminAccessExchange.mockResolvedValue(loginResponse({}, "csrf-x"))
    expect(await bootstrap()).toBe("ok")
    expect(apiMock.adminAccessExchange).toHaveBeenCalledTimes(1)
  })

  it.each([
    ["a 401", () => new AppError(ErrorCode.UNAUTHORIZED, "no session")],
    ["a network failure", () => new TypeError("Failed to fetch")],
    ["a 500", () => foreignAppError(ErrorCode.INTERNAL)],
  ])("swallows %s on the session check and tries the exchange", async (_label, makeError) => {
    apiMock.adminSession.mockRejectedValue(makeError())
    apiMock.adminAccessExchange.mockResolvedValue(loginResponse({}, "csrf-x"))
    expect(await bootstrap()).toBe("ok")
    expect(apiMock.adminAccessExchange).toHaveBeenCalledTimes(1)
  })
})

describe("useOperatorBootstrap: Access exchange", () => {
  beforeEach(() => {
    apiMock.adminSession.mockResolvedValue({ authenticated: false })
  })

  it("stores the operator mapped from the login user plus the CSRF token", async () => {
    apiMock.adminAccessExchange.mockResolvedValue(loginResponse({}, "csrf-x"))
    expect(await bootstrap()).toBe("ok")
    expect(apiMock.adminAccessExchange).toHaveBeenCalledWith()
    expect(useAuthStore.getState()).toMatchObject({
      status: "authenticated",
      operator: { id: "op-2", name: "Grace Ops", email: "grace@civfix.org", role: "operator" },
      csrfToken: "csrf-x",
    })
  })

  it("stores exactly id, name, email and role and drops the other user fields", async () => {
    apiMock.adminAccessExchange.mockResolvedValue(loginResponse({ handle: "grace" }, "csrf-x"))
    await bootstrap()
    expect(Object.keys(useAuthStore.getState().operator ?? {}).sort()).toEqual(["email", "id", "name", "role"])
  })

  it.each([null, undefined])("maps a %s email to an empty string", async (email) => {
    apiMock.adminAccessExchange.mockResolvedValue(loginResponse({ email }, "csrf-x"))
    await bootstrap()
    expect(useAuthStore.getState().operator?.email).toBe("")
  })

  it("keeps a previously stored CSRF token when the exchange omits one", async () => {
    useAuthStore.setState({ csrfToken: "csrf-old" })
    apiMock.adminAccessExchange.mockResolvedValue(loginResponse())
    await bootstrap()
    expect(useAuthStore.getState().csrfToken).toBe("csrf-old")
  })

  it.each([
    ["a local AppError", () => new AppError(ErrorCode.FORBIDDEN, "not on allowlist")],
    ["a foreign AppError from the client bundle", () => foreignAppError(ErrorCode.FORBIDDEN)],
  ])("returns forbidden on a FORBIDDEN %s", async (_label, makeError) => {
    apiMock.adminAccessExchange.mockRejectedValue(makeError())
    expect(await bootstrap()).toBe("forbidden")
    expect(useAuthStore.getState()).toMatchObject({ status: "forbidden", operator: null })
  })

  it("drops a previously stored operator and CSRF token on forbidden", async () => {
    useAuthStore.setState({ operator: OPERATOR, csrfToken: "csrf-old", status: "authenticated" })
    apiMock.adminAccessExchange.mockRejectedValue(new AppError(ErrorCode.FORBIDDEN, "no"))
    expect(await bootstrap()).toBe("forbidden")
    expect(useAuthStore.getState()).toMatchObject({ status: "forbidden", operator: null, csrfToken: null })
  })

  it("refuses an exchanged session whose user is not an operator", async () => {
    apiMock.adminAccessExchange.mockResolvedValue(loginResponse({ role: "citizen" }, "csrf-x"))
    expect(await bootstrap()).toBe("forbidden")
    expect(useAuthStore.getState()).toMatchObject({ status: "forbidden", operator: null, csrfToken: null })
  })

  it.each([
    ["UNAUTHORIZED", () => new AppError(ErrorCode.UNAUTHORIZED, "no jwt")],
    ["INTERNAL", () => foreignAppError(ErrorCode.INTERNAL)],
    ["NOT_FOUND", () => new AppError(ErrorCode.NOT_FOUND, "no route")],
    ["a network failure", () => new TypeError("Failed to fetch")],
    ["a non-Error rejection", () => "boom"],
  ])("returns error and goes anonymous on %s", async (_label, makeError) => {
    apiMock.adminAccessExchange.mockRejectedValue(makeError())
    expect(await bootstrap()).toBe("error")
    expect(useAuthStore.getState().status).toBe("anonymous")
  })

  it("drops a previously stored operator and CSRF token on a retryable error", async () => {
    useAuthStore.setState({ operator: OPERATOR, csrfToken: "csrf-old", status: "authenticated" })
    apiMock.adminAccessExchange.mockRejectedValue(new TypeError("Failed to fetch"))
    expect(await bootstrap()).toBe("error")
    expect(useAuthStore.getState()).toMatchObject({ status: "anonymous", operator: null, csrfToken: null })
  })

  it("can be retried after an error", async () => {
    apiMock.adminAccessExchange
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(loginResponse({}, "csrf-x"))
    const { result } = renderBootstrap()
    const outcomes: string[] = []
    await act(async () => {
      outcomes.push(await result.current())
      outcomes.push(await result.current())
    })
    expect(outcomes).toEqual(["error", "ok"])
    expect(apiMock.adminSession).toHaveBeenCalledTimes(2)
    expect(useAuthStore.getState().status).toBe("authenticated")
  })

  it("shares one attempt between overlapping calls, so a double mount mints one session", async () => {
    let resolveExchange: (value: AdminLoginResponse) => void = () => undefined
    apiMock.adminAccessExchange.mockReturnValue(
      new Promise<AdminLoginResponse>((resolve) => {
        resolveExchange = resolve
      }),
    )
    const first = renderBootstrap()
    const second = renderBootstrap()
    let outcomes: string[] = []
    await act(async () => {
      const pending = Promise.all([first.result.current(), second.result.current()])
      await vi.waitFor(() => expect(apiMock.adminAccessExchange).toHaveBeenCalled())
      resolveExchange(loginResponse({}, "csrf-x"))
      outcomes = await pending
    })
    expect(outcomes).toEqual(["ok", "ok"])
    expect(apiMock.adminSession).toHaveBeenCalledTimes(1)
    expect(apiMock.adminAccessExchange).toHaveBeenCalledTimes(1)
  })

  it("returns a stable callback across renders", () => {
    const { result, rerender } = renderBootstrap()
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})

describe("useOperatorLogout", () => {
  let assign: ReturnType<typeof vi.fn>

  beforeEach(() => {
    assign = vi.fn()
    vi.stubGlobal("location", { ...window.location, assign })
    useAuthStore.setState({ operator: OPERATOR, csrfToken: "csrf-s", status: "authenticated" })
  })

  async function logout(client: QueryClient): Promise<void> {
    const { result } = renderHook(() => useOperatorLogout(), { wrapper: wrapperFor(client) })
    await act(async () => {
      await result.current()
    })
  }

  it("revokes the session, clears the store and the cache, then leaves via Access logout", async () => {
    apiMock.adminLogout.mockResolvedValue({ ok: true })
    const client = makeTestQueryClient()
    client.setQueryData(["admin", "reports", "list", null], { items: [] })
    await logout(client)
    expect(apiMock.adminLogout).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState()).toMatchObject({ status: "signing-out", operator: null, csrfToken: null })
    expect(client.getQueryCache().getAll()).toHaveLength(0)
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith(`${API_BASE_URL}/cdn-cgi/access/logout`)
  })

  it("clears local state into signing-out, not the signed-out screen, before navigating", async () => {
    apiMock.adminLogout.mockResolvedValue({ ok: true })
    let stateAtNavigation: unknown = null
    assign.mockImplementation(() => {
      const { status, operator, csrfToken } = useAuthStore.getState()
      stateAtNavigation = { status, operator, csrfToken }
    })
    await logout(makeTestQueryClient())
    expect(stateAtNavigation).toEqual({ status: "signing-out", operator: null, csrfToken: null })
  })

  it("reports signing-out while the revoke call is in flight and still sends the CSRF token", async () => {
    let resolveLogout: (value: { ok: true }) => void = () => undefined
    apiMock.adminLogout.mockReturnValue(
      new Promise((resolve) => {
        resolveLogout = resolve
      }),
    )
    const { result } = renderHook(() => useOperatorLogout(), { wrapper: wrapperFor(makeTestQueryClient()) })
    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current()
    })
    expect(useAuthStore.getState()).toMatchObject({ status: "signing-out", csrfToken: "csrf-s" })
    await act(async () => {
      resolveLogout({ ok: true })
      await pending
    })
  })

  it.each([
    ["a 401", () => new AppError(ErrorCode.UNAUTHORIZED, "expired")],
    ["a network failure", () => new TypeError("Failed to fetch")],
  ])("still clears and navigates when the logout call fails with %s", async (_label, makeError) => {
    apiMock.adminLogout.mockRejectedValue(makeError())
    const client = makeTestQueryClient()
    client.setQueryData(["admin", "home", "summary"], { n: 1 })
    await logout(client)
    expect(useAuthStore.getState()).toMatchObject({ status: "signing-out", operator: null, csrfToken: null })
    expect(client.getQueryCache().getAll()).toHaveLength(0)
    expect(assign).toHaveBeenCalledWith(`${API_BASE_URL}/cdn-cgi/access/logout`)
  })
})

describe("real API client 401 handling", () => {
  beforeEach(() => {
    useAuthStore.setState({ operator: OPERATOR, csrfToken: "csrf-s", status: "authenticated" })
  })

  it("clears the auth store on a 401 from the session endpoint", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { code: "UNAUTHORIZED", message: "expired" }))
    await expect(getApiClient().adminSession()).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED })
    expect(useAuthStore.getState()).toMatchObject({ status: "anonymous", operator: null, csrfToken: null })
  })

  it("clears the auth store on a 401 from any data endpoint", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))
    await expect(getApiClient().adminHomeSummary()).rejects.toMatchObject({ code: ErrorCode.UNAUTHORIZED })
    expect(useAuthStore.getState().status).toBe("anonymous")
  })

  it("leaves the auth store alone on a 403", async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { code: "FORBIDDEN", message: "no" }))
    await expect(getApiClient().adminHomeSummary()).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN })
    expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", operator: OPERATOR })
  })

  it("echoes the stored CSRF token and the web client header on logout", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))
    await getApiClient()
      .adminLogout()
      .catch(() => undefined)
    const init = fetchMock.mock.calls[0]?.[1]
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${API_BASE_URL}/v1/admin/auth/logout`)
    expect(headers["x-csrf-token"]).toBe("csrf-s")
    expect(headers["x-client"]).toBe("web")
    expect(init?.credentials).toBe("include")
  })
})

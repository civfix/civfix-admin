"use client"

import { createApiClient, type ApiClient } from "@civfix/shared/client"
import { AppError, ErrorCode } from "@civfix/shared"

import { getCsrfToken, useAuthStore } from "@/store/auth-store"

/**
 * The civfix API base URL. NEXT_PUBLIC_API_URL (inlined into the static export at build time) overrides
 * it. When unset, the default is SAME-ORIGIN ("") in a production build — the operator dashboard is
 * served behind the same Cloudflare Access app and origin as the API (admin.civfix.org → Caddy serves
 * the SPA and routes /admin/* to the backend), so relative calls resolve to admin.civfix.org/admin/* and
 * carry the Access cookie. (On the raw, ungated civfix-admin.pages.dev shell those relative /admin calls
 * 404 there, keeping it inert by design.) In development the default is the local backend so `next dev`
 * can talk to a locally-running API.
 */
export const API_BASE_URL: string = (
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080")
).replace(/\/+$/, "")

/**
 * Build the typed API client (admin surface).
 *
 * Auth model (web):
 *  - Session is a httpOnly cookie set by the API. The shared client already sends
 *    `credentials: "include"` on every request, so the cookie rides along automatically.
 *  - Mutations require a CSRF token echoed in the x-csrf-token header. We read it from the auth store
 *    at call time via getCsrfToken (the shared client only adds it for csrf endpoints).
 *  - Every request carries `X-Client: web` so the backend can distinguish web from mobile.
 *  - A 401 clears the local operator state, which flips the app to the login gate (providers.tsx
 *    renders the gate whenever there is no operator session).
 *
 * `fetchImpl` is bound to window.fetch in the browser. On the server (Next build/prerender of the
 * shell) there is no window; we fall back to globalThis.fetch so module evaluation never throws. No
 * data is fetched during the static export, only the shell is emitted.
 */
function resolveFetch(): typeof fetch {
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    return window.fetch.bind(window)
  }
  return globalThis.fetch
}

let cachedClient: ApiClient | null = null

export function getApiClient(): ApiClient {
  if (cachedClient) return cachedClient
  cachedClient = createApiClient({
    baseURL: API_BASE_URL,
    fetchImpl: resolveFetch(),
    defaultHeaders: {
      "x-client": "web",
    },
    getCsrfToken: () => getCsrfToken(),
    onUnauthorized: () => useAuthStore.getState().clear(),
  })
  return cachedClient
}

/**
 * Singleton client for app code. Importing this is safe on the server because createApiClient does not
 * perform any I/O until a method is called.
 */
export const api: ApiClient = getApiClient()

/**
 * Normalize any thrown value into an AppError so UI error states can rely on a consistent shape. The
 * shared client already throws AppError for HTTP failures; this also wraps network errors (e.g. the
 * backend is not running) into a friendly INTERNAL error.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  // The `@civfix/shared/client` bundle carries its own copy of the AppError class, so an error thrown
  // by the API client is NOT `instanceof` the AppError exported from `@civfix/shared`. Recognize it by
  // shape and re-wrap it in the local class so `code`/`fields` checks work everywhere.
  if (isAppErrorLike(err)) {
    return new AppError(err.code, err.message, {
      httpStatus: err.httpStatus,
      ...(err.fields ? { fields: err.fields } : {}),
      ...(err.requestId ? { requestId: err.requestId } : {}),
      cause: err,
    })
  }
  if (err instanceof Error) {
    return new AppError(ErrorCode.INTERNAL, err.message || "Network request failed", { cause: err })
  }
  return new AppError(ErrorCode.INTERNAL, "Unknown error")
}

function isAppErrorLike(err: unknown): err is {
  code: ErrorCode
  message: string
  httpStatus?: number
  fields?: Record<string, string>
  requestId?: string
} {
  if (!(err instanceof Error) || err.name !== "AppError") return false
  const code = (err as { code?: unknown }).code
  return typeof code === "string" && (Object.values(ErrorCode) as string[]).includes(code)
}

/** True for an AppError from either bundle: its message is API-authored copy, safe to show. */
export function isAppError(err: unknown): boolean {
  return err instanceof AppError || isAppErrorLike(err)
}

/** True when the error is a not-found (used to render tidy empty states vs. hard errors). */
export function isNotFound(err: unknown): boolean {
  return toAppError(err).code === ErrorCode.NOT_FOUND
}

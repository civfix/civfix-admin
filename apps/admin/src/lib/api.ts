"use client"

import { createApiClient, type ApiClient } from "@civfix/shared/client"
import { AppError, ErrorCode } from "@civfix/shared"

import { getCsrfToken, useAuthStore } from "@/store/auth-store"

/**
 * NEXT_PUBLIC_API_URL is inlined at build time. A production build defaults to same-origin: the SPA and
 * the API sit behind one Cloudflare Access app on admin.civfix.org, so relative calls carry the Access
 * cookie, and on the ungated civfix-admin.pages.dev shell they 404, which keeps that shell inert.
 */
export const API_BASE_URL: string = (
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080")
).replace(/\/+$/, "")

// The static export evaluates this module with no window; globalThis.fetch keeps that from throwing,
// and nothing is fetched at build time.
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
      // The backend picks the cookie + CSRF transport (not bearer) from this header.
      "x-client": "web",
    },
    getCsrfToken: () => getCsrfToken(),
    onUnauthorized: () => useAuthStore.getState().clear(),
  })
  return cachedClient
}

// Safe to create at import on the server: the client performs no I/O until a method is called.
export const api: ApiClient = getApiClient()

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err
  // `@civfix/shared/client` bundles its own AppError class, so its errors fail `instanceof` against the
  // root export; recognize them by shape and re-wrap them so `code`/`fields` checks work everywhere.
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

export function isNotFound(err: unknown): boolean {
  return toAppError(err).code === ErrorCode.NOT_FOUND
}

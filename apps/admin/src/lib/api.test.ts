import { describe, expect, it } from "vitest"
import { AppError, ErrorCode } from "@civfix/shared"

import { isNotFound, toAppError } from "./api"

/**
 * `@civfix/shared/client` ships its own copy of the AppError class, so errors thrown by the API client
 * fail `instanceof AppError` against the root export. toAppError must recognize them by shape.
 */
function foreignAppError(code: ErrorCode, message: string, fields?: Record<string, string>): Error {
  const err = new Error(message) as Error & {
    code: ErrorCode
    httpStatus: number
    fields?: Record<string, string>
    requestId?: string
  }
  err.name = "AppError"
  err.code = code
  err.httpStatus = 409
  if (fields) err.fields = fields
  err.requestId = "req-1"
  return err
}

describe("toAppError", () => {
  it("returns a real AppError untouched", () => {
    const err = new AppError(ErrorCode.CONFLICT, "taken")
    expect(toAppError(err)).toBe(err)
  })

  it("re-wraps a foreign AppError (client bundle copy) keeping code, fields and requestId", () => {
    const wrapped = toAppError(
      foreignAppError(ErrorCode.VALIDATION, "Validation failed", { slug: "bad" }),
    )
    expect(wrapped).toBeInstanceOf(AppError)
    expect(wrapped.code).toBe(ErrorCode.VALIDATION)
    expect(wrapped.message).toBe("Validation failed")
    expect(wrapped.fields).toEqual({ slug: "bad" })
    expect(wrapped.requestId).toBe("req-1")
  })

  it("does not trust an arbitrary error that merely claims a code", () => {
    const err = Object.assign(new Error("nope"), { code: "NOT_A_CODE" })
    expect(toAppError(err).code).toBe(ErrorCode.INTERNAL)
  })

  it("wraps plain errors and non-errors as INTERNAL", () => {
    expect(toAppError(new Error("boom")).code).toBe(ErrorCode.INTERNAL)
    expect(toAppError("x").code).toBe(ErrorCode.INTERNAL)
  })
})

describe("isNotFound", () => {
  it("sees a foreign NOT_FOUND", () => {
    expect(isNotFound(foreignAppError(ErrorCode.NOT_FOUND, "missing"))).toBe(true)
    expect(isNotFound(new Error("x"))).toBe(false)
  })
})

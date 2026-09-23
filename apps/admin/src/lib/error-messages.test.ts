import { describe, expect, it } from "vitest"
import { AppError, ErrorCode } from "@civfix/shared"

import { errorMessage } from "./error-messages"

const GENERIC = "Something went wrong. Please try again."

function foreignAppError(code: ErrorCode, message: string, fields?: Record<string, string>): Error {
  const err = new Error(message) as Error & { code: ErrorCode; fields?: Record<string, string> }
  err.name = "AppError"
  err.code = code
  if (fields) err.fields = fields
  return err
}

function validation(message: string, fields: Record<string, string>): AppError {
  return new AppError(ErrorCode.VALIDATION, message, { fields })
}

describe("errorMessage server message and fallback", () => {
  it("shows the server message by default", () => {
    expect(errorMessage(new AppError(ErrorCode.CONFLICT, "Slug taken"))).toBe("Slug taken")
  })

  it("uses the default generic fallback when the server message is empty", () => {
    expect(errorMessage(new AppError(ErrorCode.CONFLICT, ""))).toBe(GENERIC)
  })

  it("uses a caller fallback when the server message is empty", () => {
    expect(errorMessage(new AppError(ErrorCode.CONFLICT, ""), {}, { fallback: "Try later" })).toBe(
      "Try later",
    )
  })

  it("prefers the server message over a caller fallback", () => {
    expect(errorMessage(new AppError(ErrorCode.CONFLICT, "Slug taken"), {}, { fallback: "Try later" })).toBe(
      "Slug taken",
    )
  })

  it("ignores the server message when preferServerMessage is false", () => {
    const err = new AppError(ErrorCode.CONFLICT, "Slug taken")
    expect(errorMessage(err, {}, { preferServerMessage: false })).toBe(GENERIC)
    expect(errorMessage(err, {}, { preferServerMessage: false, fallback: "Try later" })).toBe("Try later")
  })

  it("reads the message of a foreign AppError from the client bundle", () => {
    expect(errorMessage(foreignAppError(ErrorCode.FORBIDDEN, "Nope"))).toBe("Nope")
  })

  it("shows a plain Error's message as INTERNAL", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe("Failed to fetch")
  })

  it("shows the network fallback for a plain Error with no message", () => {
    expect(errorMessage(new Error(""))).toBe("Network request failed")
  })

  it("shows \"Unknown error\" for a non-Error value rather than the fallback (current behavior)", () => {
    expect(errorMessage("boom")).toBe("Unknown error")
    expect(errorMessage(undefined, {}, { fallback: "Try later" })).toBe("Unknown error")
  })

  it("uses the fallback for a non-Error value when preferServerMessage is false", () => {
    expect(errorMessage(null, {}, { preferServerMessage: false, fallback: "Try later" })).toBe("Try later")
  })
})

describe("errorMessage code overrides", () => {
  it("uses the override for the matching code", () => {
    const err = new AppError(ErrorCode.RATE_LIMITED, "Too many requests")
    expect(errorMessage(err, { [ErrorCode.RATE_LIMITED]: "Slow down" })).toBe("Slow down")
  })

  it("wins over preferServerMessage false and the fallback", () => {
    const err = new AppError(ErrorCode.NOT_FOUND, "missing")
    expect(
      errorMessage(err, { [ErrorCode.NOT_FOUND]: "Gone" }, { preferServerMessage: false, fallback: "x" }),
    ).toBe("Gone")
  })

  it("ignores overrides for other codes", () => {
    const err = new AppError(ErrorCode.CONFLICT, "Slug taken")
    expect(errorMessage(err, { [ErrorCode.NOT_FOUND]: "Gone" })).toBe("Slug taken")
  })

  it("applies an empty-string override as the message", () => {
    const err = new AppError(ErrorCode.CONFLICT, "Slug taken")
    expect(errorMessage(err, { [ErrorCode.CONFLICT]: "" })).toBe("")
  })

  it("maps a non-Error value through the INTERNAL override", () => {
    expect(errorMessage(42, { [ErrorCode.INTERNAL]: "Server trouble" })).toBe("Server trouble")
  })

  it("matches a foreign AppError's code", () => {
    expect(
      errorMessage(foreignAppError(ErrorCode.FORBIDDEN, "Nope"), { [ErrorCode.FORBIDDEN]: "Operators only" }),
    ).toBe("Operators only")
  })
})

describe("errorMessage field errors", () => {
  const fields = {
    contactEmail: { unverified: "Verify the contact email first", invalid: "Email looks wrong" },
    slug: { taken: "That slug is in use" },
  }

  it("maps a field value to its copy", () => {
    expect(errorMessage(validation("bad", { contactEmail: "unverified" }), {}, { fields })).toBe(
      "Verify the contact email first",
    )
  })

  it("beats a code override", () => {
    expect(
      errorMessage(
        validation("bad", { slug: "taken" }),
        { [ErrorCode.VALIDATION]: "Check the form" },
        { fields },
      ),
    ).toBe("That slug is in use")
  })

  it("takes the first matching field in the order of opts.fields", () => {
    expect(
      errorMessage(validation("bad", { slug: "taken", contactEmail: "invalid" }), {}, { fields }),
    ).toBe("Email looks wrong")
  })

  it("skips a field whose value has no copy", () => {
    expect(
      errorMessage(validation("bad", { contactEmail: "bounced", slug: "taken" }), {}, { fields }),
    ).toBe("That slug is in use")
  })

  it("falls through to the override when no field value matches", () => {
    expect(
      errorMessage(
        validation("bad", { contactEmail: "bounced" }),
        { [ErrorCode.VALIDATION]: "Check the form" },
        { fields },
      ),
    ).toBe("Check the form")
  })

  it("falls through to the server message when no field or override matches", () => {
    expect(errorMessage(validation("Server says no", { other: "x" }), {}, { fields })).toBe("Server says no")
  })

  it("ignores opts.fields when the error carries no fields", () => {
    expect(errorMessage(new AppError(ErrorCode.VALIDATION, "Server says no"), {}, { fields })).toBe(
      "Server says no",
    )
  })

  it("ignores the error's fields when opts.fields is not given", () => {
    expect(errorMessage(validation("Server says no", { slug: "taken" }))).toBe("Server says no")
  })

  it("matches fields on any error code, not only VALIDATION", () => {
    const err = new AppError(ErrorCode.CONFLICT, "conflict", { fields: { slug: "taken" } })
    expect(errorMessage(err, {}, { fields })).toBe("That slug is in use")
  })

  it("reads fields from a foreign AppError", () => {
    expect(
      errorMessage(foreignAppError(ErrorCode.VALIDATION, "bad", { slug: "taken" }), {}, { fields }),
    ).toBe("That slug is in use")
  })

  it("returns an inherited Object.prototype member when a field value names one (current behavior)", () => {
    expect(errorMessage(validation("bad", { slug: "toString" }), {}, { fields })).toBe(
      Object.prototype.toString,
    )
  })
})

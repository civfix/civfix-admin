import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AppError, ErrorCode } from "@civfix/shared"

import { ErrorBoundary, isChunkLoadError } from "@/components/shell/error-boundary"

const RENDER_FAILED_COPY = "This page hit an unexpected error. Try again, or reload the dashboard."

function chunkLoadError(): Error {
  const err = new Error("Loading chunk 812 failed.\n(error: https://admin.civfix.org/_next/static/chunks/812.js)")
  err.name = "ChunkLoadError"
  return err
}

let shouldThrow: unknown = null

function Flaky() {
  if (shouldThrow !== null) throw shouldThrow
  return <p>Page content</p>
}

beforeEach(() => {
  // React reports every error a boundary catches to console.error; keep the run output readable.
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  shouldThrow = null
})

describe("isChunkLoadError", () => {
  it("recognizes webpack's ChunkLoadError by name", () => {
    expect(isChunkLoadError(chunkLoadError())).toBe(true)
  })

  it.each([
    "Loading CSS chunk 44 failed.",
    "Failed to fetch dynamically imported module: https://admin.civfix.org/_next/static/chunks/a.js",
    "Importing a module script failed.",
    "error loading dynamically imported module",
  ])("recognizes the browser message %j", (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true)
  })

  it("does not treat an ordinary render error or a non-error as a chunk failure", () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'cls')"))).toBe(false)
    expect(isChunkLoadError("Loading chunk 1 failed")).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
  })
})

describe("ErrorBoundary", () => {
  it("renders its children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )
    expect(screen.getByText("Page content")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("replaces a render error with an alert offering Try again and Reload", async () => {
    const user = userEvent.setup()
    const reload = vi.fn()
    shouldThrow = new TypeError("Cannot read properties of undefined (reading 'cls')")
    render(
      <ErrorBoundary reload={reload}>
        <Flaky />
      </ErrorBoundary>,
    )

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Something went wrong")
    expect(alert).toHaveTextContent(RENDER_FAILED_COPY)
    expect(alert).not.toHaveTextContent("Cannot read properties")
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument()

    await user.click(within(alert).getByRole("button", { name: "Reload" }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("shows an API error's own message", () => {
    shouldThrow = new AppError(ErrorCode.FORBIDDEN, "Operators only.")
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Operators only.")
    expect(alert).not.toHaveTextContent(RENDER_FAILED_COPY)
  })

  it("remounts its children on Try again", async () => {
    const user = userEvent.setup()
    shouldThrow = new Error("transient")
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )
    expect(screen.getByRole("alert")).toBeInTheDocument()

    shouldThrow = null
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("Page content")).toBeInTheDocument()
  })

  it("offers only Reload for a chunk that failed to download", async () => {
    const user = userEvent.setup()
    const reload = vi.fn()
    shouldThrow = chunkLoadError()
    render(
      <ErrorBoundary reload={reload}>
        <Flaky />
      </ErrorBoundary>,
    )

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("This page could not load")
    expect(alert).not.toHaveTextContent("812.js")
    expect(within(alert).queryByRole("button", { name: "Try again" })).toBeNull()

    await user.click(within(alert).getByRole("button", { name: "Reload" }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("catches a thrown non-error value", () => {
    shouldThrow = "boom"
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    )
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Something went wrong")
    expect(alert).toHaveTextContent(RENDER_FAILED_COPY)
  })
})

import { act, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AppShell } from "@/components/shell/app-shell"
import { useUiStore } from "@/store/ui-store"
import { renderWithQuery } from "@/test/render"

vi.mock("@/components/shell/page-registry", async () => {
  const React = await import("react")
  function chunkLoadError(): Error {
    const err = new Error("Loading chunk 812 failed.")
    err.name = "ChunkLoadError"
    return err
  }
  function HomeStub() {
    return <h1>Home stub</h1>
  }
  function BrokenPage(): React.ReactNode {
    throw new TypeError("Cannot read properties of undefined (reading 'cls')")
  }
  return {
    PAGE_REGISTRY: {
      home: React.lazy(async () => ({ default: HomeStub })),
      reports: React.lazy(() => Promise.reject(chunkLoadError())),
      events: React.lazy(async () => ({ default: BrokenPage })),
    },
  }
})

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  act(() => useUiStore.setState({ page: "home", focusId: null }))
})

describe("AppShell error containment", () => {
  it("keeps the shell usable when a section chunk fails to download, offering Reload", async () => {
    const user = userEvent.setup()
    useUiStore.setState({ page: "reports", focusId: null })
    renderWithQuery(<AppShell />)

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("This page could not load")
    expect(within(alert).getByRole("button", { name: "Reload" })).toBeInTheDocument()
    expect(within(alert).queryByRole("button", { name: "Try again" })).toBeNull()

    await user.click(screen.getByRole("button", { name: "Dashboard" }))
    expect(await screen.findByRole("heading", { name: "Home stub" })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("contains a section render error to the page and resets it on navigation", async () => {
    const user = userEvent.setup()
    useUiStore.setState({ page: "events", focusId: null })
    renderWithQuery(<AppShell />)

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Something went wrong")
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument()
    expect(within(alert).getByRole("button", { name: "Reload" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Dashboard" }))
    expect(await screen.findByRole("heading", { name: "Home stub" })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
  })
})

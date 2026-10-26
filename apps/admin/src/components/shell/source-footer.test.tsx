import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SourceFooter } from "@/components/shell/source-footer"
import { useUiStore } from "@/store/ui-store"

beforeEach(() => {
  window.history.replaceState(null, "", "/")
  useUiStore.setState({ page: "home", focusId: null })
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  window.history.replaceState(null, "", "/")
})

describe("SourceFooter", () => {
  it("T3: the Legal link opens the legal page", async () => {
    render(<SourceFooter />)

    const link = screen.getByRole("link", { name: "Legal" })
    expect(link).toHaveAttribute("href", "#/legal")

    await userEvent.click(link)
    expect(window.location.hash).toBe("#/legal")
    expect(useUiStore.getState().page).toBe("legal")
  })
})

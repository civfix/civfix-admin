import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { dragOutToBackdrop } from "@/test/modal"
import { renderWithQuery } from "@/test/render"
import { CreateOrgPanel } from "@/features/orgs/create-org-panel"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

// The backdrop is decorative (no role or name) and a sibling of the panel, so its class is the only
// handle on it.
function backdrop(): HTMLElement {
  const el = document.querySelector<HTMLElement>(".panel-overlay")
  if (!el) throw new Error("backdrop is not rendered")
  return el
}

function renderPanel() {
  apiMock.listAdminUsers.mockReturnValue(new Promise(() => {}))
  const onClose = vi.fn()
  renderWithQuery(<CreateOrgPanel open onClose={onClose} onCreated={vi.fn()} />)
  return { onClose }
}

describe("CreateOrgPanel backdrop", () => {
  it("closes an untouched panel on a backdrop click", async () => {
    const { onClose } = renderPanel()
    await userEvent.click(backdrop())
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("keeps a filled-in draft open on a backdrop click", async () => {
    const { onClose } = renderPanel()
    await userEvent.type(screen.getByLabelText("Name"), "River Keepers")

    await userEvent.click(backdrop())

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog", { name: "New organization" })).toBeInTheDocument()
    expect(screen.getByLabelText("Name")).toHaveValue("River Keepers")
  })

  it("stays open, even untouched, when a press in a field is released over the backdrop", () => {
    const { onClose } = renderPanel()

    dragOutToBackdrop(screen.getByLabelText("Name"), backdrop())

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog", { name: "New organization" })).toBeInTheDocument()
    expect(screen.getByLabelText("Name")).toHaveValue("")
  })

  it("still discards a filled-in draft through Cancel", async () => {
    const { onClose } = renderPanel()
    await userEvent.type(screen.getByLabelText("Name"), "River Keepers")
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

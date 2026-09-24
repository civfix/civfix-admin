import * as React from "react"
import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppError, ErrorCode } from "@civfix/shared"
import { describe, expect, it, onTestFinished, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { dragOutToBackdrop } from "@/test/modal"
import { renderWithQuery } from "@/test/render"
import { makeQueryClient } from "@/lib/query"
import { useUiStore } from "@/store/ui-store"
import { CreateOrgPanel } from "@/features/orgs/create-org-panel"
import { makeOrg, userListItem } from "@/features/orgs/test-fixtures"

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

function Opener() {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        New organization
      </button>
      <CreateOrgPanel open={open} onClose={() => setOpen(false)} onCreated={vi.fn()} />
    </>
  )
}

describe("CreateOrgPanel focus", () => {
  it("moves focus into the panel, keeps Tab inside it and hands focus back on close", async () => {
    apiMock.listAdminUsers.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<Opener />)
    const opener = screen.getByRole("button", { name: "New organization" })

    await userEvent.click(opener)
    const dialog = screen.getByRole("dialog", { name: "New organization" })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await userEvent.tab({ shift: true })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})

describe("CreateOrgPanel logo upload", () => {
  it("cannot be dismissed while the logo is still uploading", async () => {
    const { onClose } = renderPanel()
    const logo = new File([new Uint8Array([137, 80, 78, 71])], "logo.png", { type: "image/png" })
    // Hashing is the upload's first await; holding it keeps the upload in flight.
    Object.defineProperty(logo, "arrayBuffer", { value: () => new Promise(() => {}) })

    await userEvent.upload(screen.getByLabelText(/^Logo/), logo)
    expect(await screen.findByText("Uploading the logo…")).toBeInTheDocument()

    await userEvent.keyboard("{Escape}")
    await userEvent.click(backdrop())

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled()
  })
})

describe("CreateOrgPanel owner picker", () => {
  it("labels the owner picker as a group and links its error", async () => {
    renderPanel()

    await userEvent.click(screen.getByRole("button", { name: /Create organization/ }))

    const owner = screen.getByRole("group", { name: /^Owner/ })
    expect(owner).toContainElement(within(owner).getByRole("textbox"))
    expect(owner).toHaveAccessibleDescription(/Pick the person who owns this organization\./)
  })
})

function recordToasts(): { text: string; tone: string }[] {
  const shown: { text: string; tone: string }[] = []
  const unsubscribe = useUiStore.subscribe((s, prev) => {
    if (s.toast && s.toast !== prev.toast) shown.push({ text: s.toast.text, tone: s.toast.tone })
  })
  onTestFinished(unsubscribe)
  return shown
}

async function submitCreate(): Promise<void> {
  renderWithQuery(<CreateOrgPanel open onClose={vi.fn()} onCreated={vi.fn()} />, makeQueryClient())
  await userEvent.type(screen.getByLabelText("Name"), "River Keepers")
  await userEvent.click(await screen.findByRole("button", { name: /Ana Ruiz/ }))
  await userEvent.type(screen.getByLabelText(/^Reason/), "Partner meeting")
  await userEvent.click(screen.getByRole("button", { name: /Create organization/ }))
  await waitFor(() => expect(apiMock.adminCreateOrg).toHaveBeenCalledTimes(1))
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /Create organization/ })).toBeEnabled(),
  )
}

describe("CreateOrgPanel request errors", () => {
  function mockOwner(): void {
    apiMock.listAdminUsers.mockResolvedValue({
      items: [userListItem({ id: "u-ana", name: "Ana Ruiz" })],
      nextCursor: null,
    })
  }

  it("shows exactly one error toast for a failure the form has no field for", async () => {
    mockOwner()
    apiMock.adminCreateOrg.mockRejectedValue(new AppError(ErrorCode.FORBIDDEN, "Operators only."))
    const shown = recordToasts()

    await submitCreate()

    expect(shown).toEqual([{ text: "Operators only.", tone: "error" }])
  })

  it("confirms the new organization once, in the ok tone", async () => {
    mockOwner()
    apiMock.adminCreateOrg.mockResolvedValue(makeOrg({ name: "River Keepers" }))
    const shown = recordToasts()

    await submitCreate()

    expect(shown).toEqual([{ text: "River Keepers created", tone: "ok" }])
  })

  it("shows a field error next to its field and no toast", async () => {
    mockOwner()
    apiMock.adminCreateOrg.mockRejectedValue(
      new AppError(ErrorCode.VALIDATION, "Invalid", { fields: { name: "Name is too short." } }),
    )
    const shown = recordToasts()

    await submitCreate()

    expect(screen.getByText("Name is too short.")).toBeInTheDocument()
    expect(shown).toEqual([])
  })
})

import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { confirmDialog, DialogHost, promptDialog } from "@/components/shared/dialog"
import { LightboxHost, openLightbox } from "@/components/shared/lightbox"
import { ESCAPE_OWNER_SELECTOR, hasEscapeOwner } from "@/components/shell/escape-owner"

const PHOTOS = [
  { id: "p1", url: "https://media.test/p1.jpg", alt: "Pothole on Main St" },
  { id: "p2", url: "https://media.test/p2.jpg", alt: "Pothole close-up" },
]

function Opener({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen}>
      Open modal
    </button>
  )
}

afterEach(() => {
  // The hosts are backed by module-level zustand stores; close anything a test left open.
  if (document.querySelector('[role="dialog"]')) fireEvent.keyDown(window, { key: "Escape" })
})

describe("ESCAPE_OWNER_SELECTOR", () => {
  it("yields Escape to an open modal dialog", () => {
    expect(ESCAPE_OWNER_SELECTOR).toContain('[role="dialog"][aria-modal="true"]')
  })
})

describe("LightboxHost", () => {
  function renderLightbox() {
    const user = userEvent.setup()
    render(
      <>
        <Opener onOpen={() => openLightbox(PHOTOS, 0)} />
        <LightboxHost />
      </>,
    )
    return { user, opener: screen.getByRole("button", { name: "Open modal" }) }
  }

  it("renders nothing until opened", () => {
    renderLightbox()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(hasEscapeOwner(document)).toBe(false)
  })

  it("marks the frame as a labelled modal dialog the shell yields Escape to", async () => {
    const { user, opener } = renderLightbox()
    await user.click(opener)

    const frame = screen.getByRole("dialog", { name: "Pothole on Main St" })
    expect(frame).toHaveAttribute("aria-modal", "true")
    expect(frame).not.toHaveAttribute("aria-hidden")
    expect(frame).toHaveClass("lightbox")
    expect(frame.matches(ESCAPE_OWNER_SELECTOR)).toBe(true)
    expect(hasEscapeOwner(document)).toBe(true)
  })

  it("moves focus inside on open, traps Tab, and restores focus to the opener on close", async () => {
    const { user, opener } = renderLightbox()
    await user.click(opener)

    const frame = screen.getByRole("dialog")
    const close = screen.getByRole("button", { name: "Close" })
    const prev = screen.getByRole("button", { name: "Previous photo" })
    const next = screen.getByRole("button", { name: "Next photo" })
    expect(close).toHaveFocus()

    await user.tab()
    expect(prev).toHaveFocus()
    await user.tab()
    expect(next).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(next).toHaveFocus()
    expect(frame).toContainElement(document.activeElement as HTMLElement)

    await user.click(next)
    await user.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(opener).toHaveFocus()
  })

  it("restores focus to the opener when closed with Escape", async () => {
    const { user, opener } = renderLightbox()
    await user.click(opener)
    expect(opener).not.toHaveFocus()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(opener).toHaveFocus()
  })

  it("shows a loading state until the photo loads", async () => {
    const { user, opener } = renderLightbox()
    await user.click(opener)

    const img = screen.getByRole("img", { name: "Pothole on Main St" })
    expect(img).toHaveClass("pending")
    expect(screen.getByRole("status")).toHaveTextContent("Loading photo...")

    fireEvent.load(img)
    expect(img).not.toHaveClass("pending")
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("replaces a photo that fails to load with an explicit Refresh photo outcome", async () => {
    const user = userEvent.setup()
    let refreshes = 0
    render(
      <>
        <Opener onOpen={() => openLightbox(PHOTOS.slice(0, 1), 0, () => (refreshes += 1))} />
        <LightboxHost />
      </>,
    )
    await user.click(screen.getByRole("button", { name: "Open modal" }))

    fireEvent.error(screen.getByRole("img", { name: "Pothole on Main St" }))

    expect(screen.queryByRole("img")).toBeNull()
    expect(screen.getByRole("alert")).toHaveTextContent("This photo link expired")
    const refresh = screen.getByRole("button", { name: "Refresh photo" })
    expect(refresh).toHaveAttribute("type", "button")

    await user.click(refresh)
    expect(refreshes).toBe(1)
    expect(screen.queryByRole("button", { name: "Refresh photo" })).toBeNull()
    expect(screen.getByRole("img", { name: "Pothole on Main St" })).toHaveClass("pending")
  })
})

describe("DialogHost", () => {
  function renderDialog(open: () => void) {
    const user = userEvent.setup()
    render(
      <>
        <Opener onOpen={open} />
        <DialogHost />
      </>,
    )
    return { user, opener: screen.getByRole("button", { name: "Open modal" }) }
  }

  it("renders nothing until opened", () => {
    renderDialog(() => void confirmDialog({ title: "Remove report?" }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("marks a confirm as a modal dialog the shell yields Escape to", async () => {
    const { user, opener } = renderDialog(() => void confirmDialog({ title: "Remove report?" }))
    await user.click(opener)

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).not.toHaveAttribute("aria-hidden")
    expect(dialog).toHaveTextContent("Remove report?")
    expect(dialog.matches(ESCAPE_OWNER_SELECTOR)).toBe(true)
    expect(hasEscapeOwner(document)).toBe(true)
  })

  it("moves focus inside on open, traps Tab, and restores focus to the opener on close", async () => {
    let result: Promise<boolean> | undefined
    const { user, opener } = renderDialog(() => {
      result = confirmDialog({ title: "Remove report?", confirmLabel: "Remove" })
    })
    await user.click(opener)

    const dialog = screen.getByRole("dialog")
    const close = screen.getByRole("button", { name: "Close" })
    const cancel = screen.getByRole("button", { name: "Cancel" })
    const confirm = screen.getByRole("button", { name: "Remove" })
    expect(close).toHaveFocus()

    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await user.click(cancel)
    await expect(result).resolves.toBe(false)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(opener).toHaveFocus()
  })

  it("focuses the prompt field on open and traps Tab inside the prompt", async () => {
    let result: Promise<string | null> | undefined
    const { user, opener } = renderDialog(() => {
      result = promptDialog({ title: "Reason", label: "Why?", confirmLabel: "Save" })
    })
    await user.click(opener)

    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).not.toHaveAttribute("aria-hidden")
    expect(dialog.matches(ESCAPE_OWNER_SELECTOR)).toBe(true)
    const field = screen.getByRole("textbox")
    expect(field).toHaveFocus()

    await user.type(field, "spam")
    await user.tab()
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus()
    await user.tab()
    expect(field).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus()

    await user.click(screen.getByRole("button", { name: "Save" }))
    await expect(result).resolves.toBe("spam")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  // The textarea's autoFocus runs in React's commit phase, before useModalFocus's effect records the
  // element to restore, so the hook captures the textarea itself and has nothing live to return to.
  it("drops focus to the body when a prompt closes (current behavior: prompt does not restore focus to the opener)", async () => {
    const { user, opener } = renderDialog(() => {
      void promptDialog({ title: "Reason" })
    })
    await user.click(opener)
    expect(screen.getByRole("textbox")).toHaveFocus()

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(opener).not.toHaveFocus()
    expect(document.activeElement).toBe(document.body)
  })

  it("restores focus to the opener when closed with Escape", async () => {
    let result: Promise<boolean> | undefined
    const { user, opener } = renderDialog(() => {
      result = confirmDialog({ title: "Remove report?" })
    })
    await user.click(opener)
    expect(opener).not.toHaveFocus()

    await user.keyboard("{Escape}")
    await expect(result).resolves.toBe(false)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(opener).toHaveFocus()
  })
})

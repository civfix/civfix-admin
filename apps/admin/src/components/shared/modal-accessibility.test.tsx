import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { confirmDialog, DialogHost, promptDialog } from "@/components/shared/dialog"
import { LightboxHost, openLightbox } from "@/components/shared/lightbox"
import { ESCAPE_OWNER_SELECTOR, hasEscapeOwner } from "@/components/shell/escape-owner"
import { dragOutToBackdrop, overlayOf } from "@/test/modal"

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

// A browser sends each auto-repeated keydown to the focused element and, unless a listener cancels
// it, activates a focused button on every repeat.
function pressRepeatedEnterOnFocus(): void {
  const target = document.activeElement as HTMLElement
  const unprevented = fireEvent.keyDown(target, { key: "Enter", repeat: true })
  if (unprevented && target.tagName === "BUTTON") fireEvent.click(target)
}

async function settledYet(promise: Promise<unknown>): Promise<boolean> {
  const pending = Symbol("pending")
  return (await Promise.race([promise, Promise.resolve(pending)])) !== pending
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
    expect(screen.getByRole("status")).toHaveTextContent("Loading photo...")

    fireEvent.load(img)
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("closes on a click on the backdrop", async () => {
    const { user, opener } = renderLightbox()
    await user.click(opener)

    await user.click(overlayOf(screen.getByRole("dialog")))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("stays open when a press that started inside the frame is released over the backdrop", async () => {
    const { user, opener } = renderLightbox()
    await user.click(opener)
    const frame = screen.getByRole("dialog")

    dragOutToBackdrop(screen.getByRole("img", { name: "Pothole on Main St" }), overlayOf(frame))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
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
    expect(screen.getByRole("img", { name: "Pothole on Main St" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Loading photo...")
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
    expect(confirm).toHaveFocus()

    await user.tab()
    expect(close).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab({ shift: true })
    expect(cancel).toHaveFocus()
    await user.tab({ shift: true })
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

  it("puts initial focus on the confirm button for a non-danger confirm and confirms on Enter", async () => {
    let result: Promise<boolean> | undefined
    const { user, opener } = renderDialog(() => {
      result = confirmDialog({ title: "Remove report?", confirmLabel: "Remove" })
    })
    await user.click(opener)
    expect(screen.getByRole("button", { name: "Remove" })).toHaveFocus()

    await user.keyboard("{Enter}")
    await expect(result).resolves.toBe(true)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("cancels, not confirms, when Enter is pressed on the Close button", async () => {
    let result: Promise<boolean> | undefined
    const { user, opener } = renderDialog(() => {
      result = confirmDialog({ title: "Remove report?", confirmLabel: "Remove" })
    })
    await user.click(opener)
    screen.getByRole("button", { name: "Close" }).focus()

    await user.keyboard("{Enter}")
    await expect(result).resolves.toBe(false)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("puts initial focus on Cancel for a danger confirm and cancels on Enter", async () => {
    let result: Promise<boolean> | undefined
    const { user, opener } = renderDialog(() => {
      result = confirmDialog({ title: "Ban user?", confirmLabel: "Ban", danger: true })
    })
    await user.click(opener)
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus()

    await user.keyboard("{Enter}")
    await expect(result).resolves.toBe(false)
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(opener).toHaveFocus()
  })

  it("cancels when Enter is pressed after tabbing to Cancel", async () => {
    let result: Promise<boolean> | undefined
    const { user, opener } = renderDialog(() => {
      result = confirmDialog({ title: "Remove report?", confirmLabel: "Remove" })
    })
    await user.click(opener)
    await user.tab({ shift: true })
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus()

    await user.keyboard("{Enter}")
    await expect(result).resolves.toBe(false)
  })

  it("confirms when Enter is pressed on the focused confirm button", async () => {
    let result: Promise<boolean> | undefined
    const { user, opener } = renderDialog(() => {
      result = confirmDialog({ title: "Ban user?", confirmLabel: "Ban", danger: true })
    })
    await user.click(opener)
    await user.tab()
    expect(screen.getByRole("button", { name: "Ban" })).toHaveFocus()

    await user.keyboard("{Enter}")
    await expect(result).resolves.toBe(true)
  })

  it("still confirms on Enter from a target that has no activation of its own", async () => {
    let result: Promise<boolean> | undefined
    const { user, opener } = renderDialog(() => {
      result = confirmDialog({ title: "Remove report?" })
    })
    await user.click(opener)

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" })
    await expect(result).resolves.toBe(true)
  })

  it("does not confirm a danger confirm on Enter once a click on its text moved focus to the page", async () => {
    let result: Promise<boolean> | undefined
    const { user, opener } = renderDialog(() => {
      result = confirmDialog({
        title: "Ban user?",
        body: "They lose access right away.",
        confirmLabel: "Ban",
        danger: true,
      })
    })
    await user.click(opener)
    await user.click(screen.getByText("They lose access right away."))
    expect(document.activeElement).toBe(document.body)

    await user.keyboard("{Enter}")
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(await settledYet(result!)).toBe(false)
  })

  it("ignores an auto-repeated Enter so a held key cannot answer the dialog it just opened", async () => {
    let result: Promise<boolean> | undefined
    const { user, opener } = renderDialog(() => {
      result = confirmDialog({ title: "Remove report?", confirmLabel: "Remove" })
    })
    await user.click(opener)

    pressRepeatedEnterOnFocus()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(await settledYet(result!)).toBe(false)
  })

  it("adds a newline on Enter in the prompt field and submits on Ctrl+Enter or Cmd+Enter", async () => {
    let result: Promise<string | null> | undefined
    const { user, opener } = renderDialog(() => {
      result = promptDialog({ title: "Reason", confirmLabel: "Save" })
    })
    await user.click(opener)
    const field = screen.getByRole("textbox")

    await user.type(field, "spam{Enter}bot")
    expect(field).toHaveValue("spam\nbot")
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    await user.keyboard("{Control>}{Enter}{/Control}")
    await expect(result).resolves.toBe("spam\nbot")

    await user.click(opener)
    await user.type(screen.getByRole("textbox"), "again")
    await user.keyboard("{Meta>}{Enter}{/Meta}")
    await expect(result).resolves.toBe("again")
  })

  it("cancels a prompt on a click on the backdrop", async () => {
    let result: Promise<string | null> | undefined
    const { user, opener } = renderDialog(() => {
      result = promptDialog({ title: "Reason" })
    })
    await user.click(opener)

    await user.click(overlayOf(screen.getByRole("dialog")))
    await expect(result).resolves.toBeNull()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("keeps a prompt and its typed reason when a text selection is released over the backdrop", async () => {
    const { user, opener } = renderDialog(() => {
      void promptDialog({ title: "Reason" })
    })
    await user.click(opener)
    const field = screen.getByRole("textbox")
    await user.type(field, "duplicate of an open report")

    dragOutToBackdrop(field, overlayOf(screen.getByRole("dialog")))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("textbox")).toHaveValue("duplicate of an open report")
  })

  // The textarea's autoFocus runs in React's commit phase, before useModalFocus's effect records the
  // element to restore, so the hook captures the textarea itself and has nothing live to return to.
  it("drops focus to the body instead of restoring the opener when a prompt closes (current behavior)", async () => {
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

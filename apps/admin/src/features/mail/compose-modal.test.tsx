import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  GetForwardTemplateDefaultResponse,
  InboxListResponse,
  MailListResponse,
  MailStatsResponse,
} from "@civfix/shared"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { AppShell } from "@/components/shell/app-shell"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { waitForSectionPage } from "@/test/shell"
import { useUiStore } from "@/store/ui-store"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

// Rendered inside the real shell so its global "Escape goes home" handler is live: that handler is
// what used to navigate away and drop the draft.
async function openMail() {
  apiMock.getMailStats.mockResolvedValue({
    unread: 0,
    threads: 0,
    sent: 0,
    bounced: 0,
    failed: 0,
  } satisfies MailStatsResponse)
  apiMock.getForwardTemplateDefault.mockResolvedValue({
    subjectTemplate: null,
    bodyTemplate: null,
    updatedAt: null,
  } satisfies GetForwardTemplateDefaultResponse)
  apiMock.listInbox.mockResolvedValue({ items: [], nextCursor: null } satisfies InboxListResponse)
  apiMock.listMail.mockResolvedValue({ items: [], nextCursor: null } satisfies MailListResponse)
  const user = userEvent.setup()
  renderWithQuery(<AppShell />)
  await waitForSectionPage()
  const opener = screen.getByRole("button", { name: "Compose" })
  return { user, opener }
}

async function openCompose() {
  const ctx = await openMail()
  await ctx.user.click(ctx.opener)
  return { ...ctx, dialog: screen.getByRole("dialog", { name: "New message" }) }
}

function overlayOf(dialog: HTMLElement): HTMLElement {
  const overlay = dialog.parentElement
  if (!overlay) throw new Error("dialog has no overlay")
  return overlay
}

// The section page is a React.lazy chunk: the first render in this worker would otherwise pay the cold
// module transform inside the first wait's 1000 ms budget, which a loaded machine overruns.
beforeAll(async () => {
  await import("@/features/mail/mail-page")
})

beforeEach(() => {
  window.history.replaceState(null, "", "#/mail")
  useUiStore.setState({ page: "mail", focusId: null })
})

describe("Mail compose modal", () => {
  it("is a labelled modal dialog with a named close button", async () => {
    const { dialog } = await openCompose()
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument()
  })

  it("starts in the To field and keeps Tab inside the dialog", async () => {
    const { user, dialog } = await openCompose()
    expect(within(dialog).getByLabelText("To")).toHaveFocus()

    for (let i = 0; i < 8; i++) {
      await user.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
    for (let i = 0; i < 8; i++) {
      await user.tab({ shift: true })
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it("keeps a dirty draft on Escape from a button and does not send the shell home", async () => {
    const { user, dialog } = await openCompose()
    await user.type(within(dialog).getByLabelText("To"), "works@oaklandca.gov")
    await user.type(within(dialog).getByLabelText("Subject"), "Pothole")
    await user.type(within(dialog).getByLabelText("Message"), "Please take a look.")
    within(dialog).getByRole("button", { name: "Send" }).focus()

    await user.keyboard("{Escape}")

    expect(screen.getByRole("dialog", { name: "New message" })).toBeInTheDocument()
    expect(screen.getByLabelText("To")).toHaveValue("works@oaklandca.gov")
    expect(screen.getByLabelText("Message")).toHaveValue("Please take a look.")
    expect(window.location.hash).toBe("#/mail")
    expect(useUiStore.getState().page).toBe("mail")
  })

  it("keeps a dirty draft on a backdrop click", async () => {
    const { user, dialog } = await openCompose()
    await user.type(within(dialog).getByLabelText("Subject"), "Pothole")

    await user.click(overlayOf(dialog))

    expect(screen.getByRole("dialog", { name: "New message" })).toBeInTheDocument()
    expect(screen.getByLabelText("Subject")).toHaveValue("Pothole")
  })

  it("closes an empty draft on Escape without leaving Mail, and restores focus", async () => {
    const { user, opener, dialog } = await openCompose()
    within(dialog).getByRole("button", { name: "Cancel" }).focus()

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(window.location.hash).toBe("#/mail")
    expect(useUiStore.getState().page).toBe("mail")
    expect(opener).toHaveFocus()
  })

  it("closes an empty draft on a backdrop click", async () => {
    const { user, dialog } = await openCompose()
    await user.click(overlayOf(dialog))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("discards a dirty draft only through the close button, and returns focus to Compose", async () => {
    const { user, opener, dialog } = await openCompose()
    await user.type(within(dialog).getByLabelText("Subject"), "Pothole")

    await user.click(within(dialog).getByRole("button", { name: "Close" }))

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(opener).toHaveFocus()
    await user.click(opener)
    expect(screen.getByLabelText("Subject")).toHaveValue("")
  })
})

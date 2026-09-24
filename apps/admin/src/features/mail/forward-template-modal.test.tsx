import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  DEFAULT_FORWARD_SUBJECT_TEMPLATE,
  type GetForwardTemplateDefaultResponse,
  type InboxListResponse,
  type MailListResponse,
  type MailStatsResponse,
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

const TITLE = "Default forwarding email"

// Rendered inside the real shell so its global "Escape goes home" handler is live.
async function openTemplate() {
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
  const opener = screen.getByRole("button", { name: "Default template" })
  await vi.waitFor(() => expect(opener).toBeEnabled())
  await user.click(opener)
  return { user, opener, dialog: screen.getByRole("dialog", { name: TITLE }) }
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

describe("Forward template modal", () => {
  it("is a labelled modal dialog with a named close button", async () => {
    const { dialog } = await openTemplate()
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument()
  })

  it("moves focus inside and keeps Tab inside the dialog", async () => {
    const { user, dialog } = await openTemplate()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    for (let i = 0; i < 20; i++) {
      await user.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
    for (let i = 0; i < 20; i++) {
      await user.tab({ shift: true })
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
  })

  it("keeps an edited template on Escape from a button and does not send the shell home", async () => {
    const { user, dialog } = await openTemplate()
    const subject = within(dialog).getByLabelText("Subject")
    await user.clear(subject)
    await user.type(subject, "Oakland pothole report")
    within(dialog).getByRole("button", { name: "Preview" }).focus()

    await user.keyboard("{Escape}")

    expect(screen.getByRole("dialog", { name: TITLE })).toBeInTheDocument()
    expect(screen.getByLabelText("Subject")).toHaveValue("Oakland pothole report")
    expect(window.location.hash).toBe("#/mail")
    expect(useUiStore.getState().page).toBe("mail")
  })

  it("keeps an edited template on a backdrop click", async () => {
    const { user, dialog } = await openTemplate()
    await user.click(within(dialog).getByRole("button", { name: "Clear" }))

    await user.click(overlayOf(dialog))

    expect(screen.getByRole("dialog", { name: TITLE })).toBeInTheDocument()
    expect(screen.getByLabelText("Subject")).toHaveValue("")
  })

  it("closes an unedited template on Escape without leaving Mail, and restores focus", async () => {
    const { user, opener, dialog } = await openTemplate()
    within(dialog).getByRole("button", { name: "Cancel" }).focus()

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(window.location.hash).toBe("#/mail")
    expect(useUiStore.getState().page).toBe("mail")
    expect(opener).toHaveFocus()
  })

  it("closes an unedited template on a backdrop click", async () => {
    const { user, dialog } = await openTemplate()
    await user.click(overlayOf(dialog))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("discards an edit only through Cancel, and returns focus to the opener", async () => {
    const { user, opener, dialog } = await openTemplate()
    await user.click(within(dialog).getByRole("button", { name: "Clear" }))

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(opener).toHaveFocus()
    await user.click(opener)
    expect(screen.getByLabelText("Subject")).toHaveValue(DEFAULT_FORWARD_SUBJECT_TEMPLATE)
  })
})

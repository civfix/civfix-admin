import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"

import { confirmDialog, DialogHost, promptDialog } from "@/components/shared/dialog"

function renderHost() {
  const user = userEvent.setup()
  render(<DialogHost />)
  return user
}

afterEach(() => {
  // The host is backed by a module-level zustand store; close anything a test left open.
  if (document.querySelector('[role="dialog"]')) fireEvent.keyDown(window, { key: "Escape" })
})

describe("DialogHost", () => {
  it("bounds the prompt field by the request's maxLength", async () => {
    renderHost()
    void promptDialog({ title: "Void entry", label: "Reason (required)", maxLength: 500 })

    expect(await screen.findByRole("textbox", { name: "Reason (required)" })).toHaveAttribute(
      "maxlength",
      "500",
    )
  })

  it("drops the cancel button only for an acknowledge-only confirm", async () => {
    const user = renderHost()
    const result = confirmDialog({ title: "Certificates affected", acknowledgeOnly: true })

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).queryByRole("button", { name: "Cancel" })).toBeNull()
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }))
    await expect(result).resolves.toBe(true)

    void confirmDialog({ title: "Remove report?" })
    expect(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument()
  })

  it("renders confirm details as a list under the body", async () => {
    renderHost()
    void confirmDialog({
      title: "Certificates affected",
      body: "These certificates need a reissue.",
      details: ["CERT-1 · 4 h", "CERT-2 · 2 h"],
    })

    const dialog = await screen.findByRole("dialog")
    const items = within(within(dialog).getByRole("list")).getAllByRole("listitem")
    expect(items.map((li) => li.textContent)).toEqual(["CERT-1 · 4 h", "CERT-2 · 2 h"])
    expect(
      within(dialog)
        .getByText("These certificates need a reissue.")
        .compareDocumentPosition(within(dialog).getByRole("list")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

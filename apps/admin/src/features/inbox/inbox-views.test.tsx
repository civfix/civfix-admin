import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { InboundEmailDTO, InboxFeedEmailItemDTO } from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { startFakeTimersWithUser } from "@/test/fake-timers"
import { renderWithQuery } from "@/test/render"
import { InboxReader, InboxRow } from "@/features/inbox/inbox-views"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const TS = "2026-09-20T15:00:00.000Z"

const EMAIL = {
  source: "email",
  id: "i-1",
  from: "resident@example.com",
  recipient: "support@civfix.org",
  localPart: "support",
  subject: "Photos of the dumping",
  preview: "See attached",
  ts: TS,
  status: "unread",
  unread: true,
  hasAttachments: true,
} satisfies InboxFeedEmailItemDTO

const MESSAGE = {
  id: "i-1",
  from: "resident@example.com",
  recipient: "support@civfix.org",
  localPart: "support",
  subject: "Photos of the dumping",
  preview: "See attached",
  ts: TS,
  status: "read",
  unread: false,
  hasAttachments: true,
  bodyText: "See attached",
  bodyHtml: null,
  messageId: null,
  attachments: [
    { key: "https://media.civfix.org/att/1?sig=a", filename: "note.txt", size: 300 },
    { key: "https://media.civfix.org/att/2?sig=b", filename: "photo.jpg", size: 20_480 },
    { key: "https://media.civfix.org/att/3?sig=c", filename: "video.mp4", size: 20 * 1024 * 1024 },
  ],
} satisfies InboundEmailDTO

describe("InboxRow", () => {
  it("is a keyboard-operable row that marks itself current when selected", async () => {
    const onClick = vi.fn()
    const { rerender } = renderWithQuery(<InboxRow item={EMAIL} selected={false} onClick={onClick} />)
    const row = screen.getByRole("button", { name: /Photos of the dumping/ })
    expect(row).toHaveAttribute("tabindex", "0")
    expect(row).not.toHaveAttribute("aria-current")

    row.focus()
    await userEvent.keyboard("{Enter}")
    await userEvent.keyboard(" ")
    expect(onClick).toHaveBeenCalledTimes(2)

    rerender(<InboxRow item={EMAIL} selected onClick={onClick} />)
    expect(screen.getByRole("button", { name: /Photos of the dumping/ })).toHaveAttribute(
      "aria-current",
      "true",
    )
  })

  it("names the attachment marker and does not dim the recipient below the preview text", () => {
    renderWithQuery(<InboxRow item={EMAIL} selected={false} onClick={() => {}} />)
    expect(screen.getByRole("img", { name: "Has attachments" })).toBeInTheDocument()
    expect(screen.getByText("support")).not.toHaveStyle({ opacity: "0.6" })
  })

  it("leaves the timestamp tooltip empty for an unparseable time", () => {
    renderWithQuery(<InboxRow item={{ ...EMAIL, ts: "" }} selected={false} onClick={() => {}} />)
    expect(screen.queryByTitle("Invalid Date")).not.toBeInTheDocument()
  })
})

describe("InboxReader", () => {
  it("labels attachment sizes in bytes, KB and MB", async () => {
    apiMock.getInboxMessage.mockResolvedValue(MESSAGE)
    renderWithQuery(<InboxReader id="i-1" />)

    expect(await screen.findByRole("link", { name: /note\.txt/ })).toHaveTextContent("300 B")
    expect(screen.getByRole("link", { name: /photo\.jpg/ })).toHaveTextContent("20 KB")
    expect(screen.getByRole("link", { name: /video\.mp4/ })).toHaveTextContent("20 MB")
  })

  it("re-reads an open message before its presigned attachment links expire", async () => {
    startFakeTimersWithUser()
    apiMock.getInboxMessage.mockResolvedValue(MESSAGE)
    renderWithQuery(<InboxReader id="i-1" />)
    await screen.findByRole("link", { name: /note\.txt/ })
    expect(apiMock.getInboxMessage).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(10 * 60_000)

    await waitFor(() => expect(apiMock.getInboxMessage).toHaveBeenCalledTimes(2))
  })

  it("does not re-read an open message that has no attachments", async () => {
    startFakeTimersWithUser()
    apiMock.getInboxMessage.mockResolvedValue({ ...MESSAGE, hasAttachments: false, attachments: [] })
    renderWithQuery(<InboxReader id="i-1" />)
    await screen.findByText("See attached", { selector: "p" })

    await vi.advanceTimersByTimeAsync(30 * 60_000)

    expect(apiMock.getInboxMessage).toHaveBeenCalledTimes(1)
  })
})
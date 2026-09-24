import { screen } from "@testing-library/react"
import type { InboundEmailDTO } from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { InboxReader } from "@/features/inbox/inbox-views"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const MESSAGE = {
  id: "i-1",
  from: "resident@example.com",
  recipient: "hello@civfix.org",
  localPart: "hello",
  subject: "Photos of the dumping",
  preview: "See attached",
  ts: "2026-09-20T15:00:00.000Z",
  status: "read",
  unread: false,
  hasAttachments: true,
  bodyText: "See attached",
  bodyHtml: null,
  messageId: null,
  attachments: [
    { key: "https://media.civfix.org/att/1?sig=abc", filename: "dumping.jpg", size: 20480 },
    { key: "http://localhost:8080/_local-storage/att/2", filename: "map.pdf", size: 4096 },
    { key: "javascript:alert(1)", filename: "invoice.html", size: 1024 },
    { key: "inbound/2026/att-4.bin", filename: "raw.bin", size: 2048 },
  ],
} satisfies InboundEmailDTO

describe("InboxReader attachments", () => {
  it("links only http(s) attachment urls, in a new tab without opener or referrer", async () => {
    apiMock.getInboxMessage.mockResolvedValue(MESSAGE)
    renderWithQuery(<InboxReader id="i-1" />)

    const photo = await screen.findByRole("link", { name: /dumping\.jpg/ })
    expect(photo).toHaveAttribute("href", "https://media.civfix.org/att/1?sig=abc")
    expect(photo).toHaveAttribute("target", "_blank")
    expect(photo).toHaveAttribute("rel", "noopener noreferrer")
    expect(screen.getByRole("link", { name: /map\.pdf/ })).toHaveAttribute(
      "href",
      "http://localhost:8080/_local-storage/att/2",
    )

    expect(screen.getAllByRole("link")).toHaveLength(2)
    expect(screen.getByText("invoice.html")).toBeInTheDocument()
    expect(screen.getByText("raw.bin")).toBeInTheDocument()
    expect(screen.getByText("invoice.html").closest("a")).toBeNull()
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull()
  })
})

import { screen } from "@testing-library/react"
import type {
  GetForwardTemplateDefaultResponse,
  InboxListResponse,
  MailListResponse,
  MailStatsResponse,
  MailThreadDTO,
  MailThreadListItemDTO,
} from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { detailCard } from "@/test/panes"
import { MailPage } from "@/features/mail/mail-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const TS = "2026-09-20T15:00:00.000Z"

const THREAD = {
  id: "t-1",
  dir: "in",
  from: "clerk@oaklandca.gov",
  to: "outreach@civfix.org",
  org: "Oakland Public Works",
  subject: "Pothole photos",
  preview: "Attached",
  ts: TS,
  unread: false,
  status: "replied",
  jurisdictionGeoid: null,
  reportId: null,
} satisfies MailThreadListItemDTO

const DETAIL = {
  ...THREAD,
  messages: [
    {
      id: "m-1",
      who: "Oakland Public Works",
      from: "clerk@oaklandca.gov",
      to: "outreach@civfix.org",
      dir: "in",
      body: "Attached",
      ts: TS,
      attachments: [
        { key: "https://media.civfix.org/att/1?sig=abc", filename: "pothole.jpg", size: 20480 },
        { key: "javascript:alert(1)", filename: "invoice.html", size: 1024 },
      ],
      delivery: "sent",
    },
  ],
} satisfies MailThreadDTO

describe("MailReader attachments", () => {
  it("links only http(s) attachment urls, in a new tab without opener or referrer", async () => {
    apiMock.getMailStats.mockResolvedValue({
      unread: 0,
      threads: 1,
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
    apiMock.listMail.mockResolvedValue({ items: [THREAD], nextCursor: null } satisfies MailListResponse)
    apiMock.getMailThread.mockResolvedValue(DETAIL)
    renderWithQuery(<MailPage focusId={null} />)

    const photo = await screen.findByRole("link", { name: /pothole\.jpg/ })
    expect(photo).toHaveAttribute("href", "https://media.civfix.org/att/1?sig=abc")
    expect(photo).toHaveAttribute("target", "_blank")
    expect(photo).toHaveAttribute("rel", "noopener noreferrer")

    const unsafe = screen.getByText("invoice.html")
    expect(detailCard()).toContainElement(unsafe)
    expect(unsafe.closest("a")).toBeNull()
    expect(unsafe).toHaveTextContent("link unavailable")
    expect(photo).not.toHaveTextContent("link unavailable")
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull()
  })
})

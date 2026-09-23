import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  GetForwardTemplateDefaultResponse,
  InboundEmailDTO,
  InboundEmailListItemDTO,
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
import { MailPage } from "@/features/mail/mail-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})


const TS = "2026-09-20T15:00:00.000Z"

function thread(over: Partial<MailThreadListItemDTO> & { id: string; subject: string }) {
  return {
    dir: "out",
    from: "outreach@civfix.org",
    to: "works@oaklandca.gov",
    org: "Oakland Public Works",
    preview: "Following up on the report",
    ts: TS,
    unread: false,
    status: "sent",
    jurisdictionGeoid: null,
    reportId: null,
    ...over,
  } satisfies MailThreadListItemDTO
}

const POTHOLE = thread({
  id: "t-1",
  subject: "Pothole on 5th Ave",
  preview: "Can your crew take a look?",
  status: "needs_action",
  dir: "in",
  from: "clerk@oaklandca.gov",
  unread: true,
})
const GRAFFITI = thread({
  id: "t-2",
  subject: "Graffiti at Lake Merritt",
  org: "Parks Department",
  status: "replied",
})

function mailPage(items: MailThreadListItemDTO[], nextCursor: string | null = null) {
  return { items, nextCursor } satisfies MailListResponse
}

function threadDetail(item: MailThreadListItemDTO): MailThreadDTO {
  return {
    ...item,
    messages: [
      {
        id: `${item.id}-m1`,
        who: "civfix outreach",
        from: "outreach@civfix.org",
        to: item.to,
        dir: "out",
        body: `Body of ${item.subject}`,
        ts: TS,
        attachments: [],
        delivery: "sent",
      },
    ],
  } satisfies MailThreadDTO
}

function mockThreads(...items: MailThreadListItemDTO[]) {
  apiMock.getMailThread.mockImplementation(async ({ id }: { id: string }) => {
    const t = items.find((x) => x.id === id)
    if (!t) throw new Error(`no thread ${id}`)
    return threadDetail(t)
  })
}

function inboxItem(over: Partial<InboundEmailListItemDTO> & { id: string; subject: string }) {
  return {
    from: "resident@example.com",
    recipient: "hello@civfix.org",
    localPart: "hello",
    preview: "Quick question",
    ts: TS,
    status: "unread",
    unread: true,
    hasAttachments: false,
    ...over,
  } satisfies InboundEmailListItemDTO
}

const QUESTION = inboxItem({ id: "i-1", subject: "Question about my report", localPart: "support" })
const PRESS = inboxItem({
  id: "i-2",
  subject: "Press inquiry",
  from: "reporter@news.example",
  status: "read",
  unread: false,
})

function inboxPage(items: InboundEmailListItemDTO[], nextCursor: string | null = null) {
  return { items, nextCursor } satisfies InboxListResponse
}

function inboxDetail(item: InboundEmailListItemDTO): InboundEmailDTO {
  return {
    ...item,
    bodyText: `Body of ${item.subject}`,
    bodyHtml: null,
    messageId: null,
    attachments: [],
  } satisfies InboundEmailDTO
}

function mockInboxMessages(...items: InboundEmailListItemDTO[]) {
  apiMock.getInboxMessage.mockImplementation(async ({ id }: { id: string }) => {
    const m = items.find((x) => x.id === id)
    if (!m) throw new Error(`no message ${id}`)
    return inboxDetail(m)
  })
}

const STATS = { unread: 2, threads: 17, sent: 40, bounced: 3, failed: 1 } satisfies MailStatsResponse

// The page always loads the stats strip, the forward template and both folder lists, so every test
// resolves the ones it is not about.
function mockChrome({ inbox = inboxPage([]) }: { inbox?: InboxListResponse } = {}) {
  apiMock.getMailStats.mockResolvedValue(STATS)
  apiMock.getForwardTemplateDefault.mockResolvedValue({
    subjectTemplate: null,
    bodyTemplate: null,
    updatedAt: null,
  } satisfies GetForwardTemplateDefaultResponse)
  apiMock.listInbox.mockResolvedValue(inbox)
}

function listCard() {
  return document.querySelector(".md-list") as HTMLElement
}

function detailCard() {
  return document.querySelector(".md-detail-card") as HTMLElement
}

describe("MailPage outreach", () => {
  it("starts on the Outreach folder with the stats strip", async () => {
    mockChrome()
    apiMock.listMail.mockResolvedValue(mailPage([]))
    renderWithQuery(<MailPage focusId={null} />)

    expect(screen.getByRole("radio", { name: /Outreach/ })).toHaveAttribute("aria-checked", "true")
    expect(await screen.findByText("Sent · 7d")).toBeInTheDocument()
    expect(screen.getByText("40")).toBeInTheDocument()
    expect(screen.getByText("Bounced")).toBeInTheDocument()
    expect(screen.getByText("Failed")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Outreach/ })).toHaveTextContent("17")
    expect(screen.getByRole("button", { name: "All 17" })).toBeInTheDocument()
  })

  it("shows the loading state while the first page is in flight", async () => {
    mockChrome()
    apiMock.listMail.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<MailPage focusId={null} />)
    expect(within(listCard()).getByRole("status")).toHaveTextContent("Loading mail...")
    expect(within(detailCard()).getByText("No message selected")).toBeInTheDocument()
  })

  it("shows the empty copy when the folder has no threads", async () => {
    mockChrome()
    apiMock.listMail.mockResolvedValue(mailPage([]))
    renderWithQuery(<MailPage focusId={null} />)
    expect(await within(listCard()).findByText("Empty")).toBeInTheDocument()
    expect(within(listCard()).getByText("No messages here.")).toBeInTheDocument()
    expect(within(detailCard()).getByText("No message selected")).toBeInTheDocument()
  })

  it("shows the search empty copy when a search matches nothing", async () => {
    mockChrome()
    apiMock.listMail.mockResolvedValue(mailPage([]))
    renderWithQuery(<MailPage focusId={null} />)
    await within(listCard()).findByText("Empty")

    await userEvent.type(screen.getByPlaceholderText("Search org, subject, sender…"), "zzz")

    expect(await within(listCard()).findByText("Nothing matches")).toBeInTheDocument()
    expect(within(listCard()).getByText("Try a different search.")).toBeInTheDocument()
    expect(apiMock.listMail).toHaveBeenLastCalledWith({ q: "zzz" })
  })

  it("shows the error state with the failure message and a retry", async () => {
    mockChrome()
    apiMock.listMail.mockRejectedValue(new Error("Mail backend unreachable"))
    renderWithQuery(<MailPage focusId={null} />)
    const alert = await within(listCard()).findByRole("alert")
    expect(alert).toHaveTextContent("Could not load this")
    expect(alert).toHaveTextContent("Mail backend unreachable")
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("renders rows with key fields and auto-selects the first thread into the reader", async () => {
    mockChrome()
    apiMock.listMail.mockResolvedValue(mailPage([POTHOLE, GRAFFITI]))
    mockThreads(POTHOLE, GRAFFITI)
    renderWithQuery(<MailPage focusId={null} />)

    await within(listCard()).findByText("Pothole on 5th Ave")
    const list = listCard()
    expect(within(list).getByRole("heading", { name: "All" })).toBeInTheDocument()
    expect(within(list).getByText("Oakland Public Works")).toBeInTheDocument()
    expect(within(list).getByText("Can your crew take a look?")).toBeInTheDocument()
    expect(within(list).getByText("Needs action")).toBeInTheDocument()
    expect(within(list).getByText("Graffiti at Lake Merritt")).toBeInTheDocument()
    expect(within(list).getByText("Parks Department")).toBeInTheDocument()
    expect(within(list).getByText("Replied")).toBeInTheDocument()
    expect(apiMock.listMail).toHaveBeenCalledWith({})

    const card = detailCard()
    expect(await within(card).findByText("Body of Pothole on 5th Ave")).toBeInTheDocument()
    expect(within(card).getByText("Pothole on 5th Ave")).toBeInTheDocument()
    expect(within(card).getByText("civfix outreach")).toBeInTheDocument()
    // With no inbound message the correspondent falls back to the outbound recipient, shown in the
    // header and on the reply line.
    expect(within(card).getAllByText("works@oaklandca.gov")).toHaveLength(2)
    expect(within(card).getByPlaceholderText("Reply to Oakland Public Works…")).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Mark replied/ })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Reply/ })).toBeDisabled()
    expect(apiMock.getMailThread).toHaveBeenCalledWith({ id: "t-1" })
  })

  it("opens the clicked thread in the reader", async () => {
    mockChrome()
    apiMock.listMail.mockResolvedValue(mailPage([POTHOLE, GRAFFITI]))
    mockThreads(POTHOLE, GRAFFITI)
    renderWithQuery(<MailPage focusId={null} />)
    await within(detailCard()).findByText("Body of Pothole on 5th Ave")

    await userEvent.click(within(listCard()).getByText("Graffiti at Lake Merritt"))

    const card = detailCard()
    expect(await within(card).findByText("Body of Graffiti at Lake Merritt")).toBeInTheDocument()
    expect(within(card).getByPlaceholderText("Reply to Parks Department…")).toBeInTheDocument()
    expect(apiMock.getMailThread).toHaveBeenCalledWith({ id: "t-2" })
  })

  it("marks an unread thread read when it is clicked", async () => {
    mockChrome()
    apiMock.listMail.mockResolvedValue(mailPage([GRAFFITI, POTHOLE]))
    apiMock.markMailRead.mockResolvedValue({ ok: true })
    mockThreads(POTHOLE, GRAFFITI)
    renderWithQuery(<MailPage focusId={null} />)
    await within(detailCard()).findByText("Body of Graffiti at Lake Merritt")

    await userEvent.click(within(listCard()).getByText("Pothole on 5th Ave"))

    await waitFor(() => expect(apiMock.markMailRead).toHaveBeenCalledWith({ id: "t-1" }))
  })

  it("sends the chosen filter chip to the api and titles the list with it", async () => {
    mockChrome()
    apiMock.listMail.mockResolvedValue(mailPage([GRAFFITI]))
    mockThreads(GRAFFITI)
    renderWithQuery(<MailPage focusId={null} />)
    await within(listCard()).findByText("Graffiti at Lake Merritt")

    await userEvent.click(screen.getByRole("button", { name: "Inbound" }))
    await waitFor(() => expect(apiMock.listMail).toHaveBeenLastCalledWith({ dir: "in" }))
    expect(within(listCard()).getByRole("heading", { name: "Inbound" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Outbound" }))
    await waitFor(() => expect(apiMock.listMail).toHaveBeenLastCalledWith({ dir: "out" }))

    await userEvent.click(screen.getByRole("button", { name: "Needs attention" }))
    await waitFor(() => expect(apiMock.listMail).toHaveBeenLastCalledWith({ filter: "attn" }))
    expect(within(listCard()).getByRole("heading", { name: "Needs attention" })).toBeInTheDocument()
  })

  it("shows Load more when a cursor is returned and fetches the next page with it", async () => {
    mockChrome()
    apiMock.listMail.mockImplementation(async (params: { cursor?: string }) =>
      params.cursor === "mail-2" ? mailPage([GRAFFITI]) : mailPage([POTHOLE], "mail-2"),
    )
    mockThreads(POTHOLE, GRAFFITI)
    renderWithQuery(<MailPage focusId={null} />)
    await within(listCard()).findByText("Pothole on 5th Ave")

    await userEvent.click(screen.getByRole("button", { name: "Load more" }))

    expect(await within(listCard()).findByText("Graffiti at Lake Merritt")).toBeInTheDocument()
    expect(apiMock.listMail).toHaveBeenLastCalledWith({ cursor: "mail-2" })
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("opens a deep-linked thread focusId that is on the first page", async () => {
    mockChrome()
    apiMock.listMail.mockResolvedValue(mailPage([POTHOLE, GRAFFITI]))
    mockThreads(POTHOLE, GRAFFITI)
    renderWithQuery(<MailPage focusId="t-2" />)
    expect(await within(detailCard()).findByText("Body of Graffiti at Lake Merritt")).toBeInTheDocument()
    expect(within(detailCard()).queryByText("Body of Pothole on 5th Ave")).not.toBeInTheDocument()
  })

  it("replaces a deep-linked thread focusId that is not on the first page with the first row (auto-select override)", async () => {
    const OLD = thread({ id: "t-9", subject: "Old thread" })
    mockChrome()
    apiMock.listMail.mockResolvedValue(mailPage([POTHOLE, GRAFFITI]))
    mockThreads(POTHOLE, GRAFFITI, OLD)
    renderWithQuery(<MailPage focusId="t-9" />)
    expect(await within(detailCard()).findByText("Body of Pothole on 5th Ave")).toBeInTheDocument()
    expect(within(detailCard()).queryByText("Body of Old thread")).not.toBeInTheDocument()
  })
})

describe("MailPage inbox", () => {
  async function openInbox() {
    await userEvent.click(screen.getByRole("radio", { name: /Inbox/ }))
  }

  it("switches to the Inbox folder with its own chips and no stats strip", async () => {
    mockChrome({ inbox: inboxPage([]) })
    apiMock.listMail.mockResolvedValue(mailPage([]))
    renderWithQuery(<MailPage focusId={null} />)
    await screen.findByText("Sent · 7d")
    await openInbox()

    expect(screen.getByRole("radio", { name: /Inbox/ })).toHaveAttribute("aria-checked", "true")
    expect(screen.queryByText("Sent · 7d")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Unread" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Archived" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Needs attention" })).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("Search sender, subject…")).toBeInTheDocument()
  })

  it("shows the loading state while the inbox is in flight", async () => {
    mockChrome()
    apiMock.listInbox.mockReturnValue(new Promise(() => {}))
    apiMock.listMail.mockResolvedValue(mailPage([]))
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()
    expect(within(listCard()).getByRole("status")).toHaveTextContent("Loading inbox...")
  })

  it("shows the empty copy when the inbox is empty", async () => {
    mockChrome({ inbox: inboxPage([]) })
    apiMock.listMail.mockResolvedValue(mailPage([]))
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()
    expect(await within(listCard()).findByText("Empty")).toBeInTheDocument()
    expect(within(listCard()).getByText("No messages here.")).toBeInTheDocument()
    expect(within(detailCard()).getByText("No message selected")).toBeInTheDocument()
  })

  it("shows the error state with the failure message and a retry", async () => {
    mockChrome()
    apiMock.listInbox.mockRejectedValue(new Error("Inbox backend unreachable"))
    apiMock.listMail.mockResolvedValue(mailPage([]))
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()
    const alert = await within(listCard()).findByRole("alert")
    expect(alert).toHaveTextContent("Could not load this")
    expect(alert).toHaveTextContent("Inbox backend unreachable")
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("renders inbox rows and auto-selects the first message into the reader", async () => {
    mockChrome({ inbox: inboxPage([QUESTION, PRESS]) })
    apiMock.listMail.mockResolvedValue(mailPage([]))
    mockInboxMessages(QUESTION, PRESS)
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()

    await within(listCard()).findByText("Question about my report")
    const list = listCard()
    expect(within(list).getByText("resident@example.com")).toBeInTheDocument()
    expect(within(list).getByText("support")).toBeInTheDocument()
    expect(within(list).getByText("Unread")).toBeInTheDocument()
    expect(within(list).getByText("Press inquiry")).toBeInTheDocument()
    expect(within(list).getByText("reporter@news.example")).toBeInTheDocument()
    expect(within(list).getByText("Read")).toBeInTheDocument()

    const card = detailCard()
    expect(await within(card).findByText("Body of Question about my report")).toBeInTheDocument()
    expect(within(card).getByText("to hello@civfix.org")).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Mark read/ })).toBeEnabled()
    expect(within(card).getByRole("button", { name: /Archive/ })).toBeEnabled()
    expect(apiMock.getInboxMessage).toHaveBeenCalledWith({ id: "i-1" })
  })

  it("opens the clicked message in the reader", async () => {
    mockChrome({ inbox: inboxPage([QUESTION, PRESS]) })
    apiMock.listMail.mockResolvedValue(mailPage([]))
    mockInboxMessages(QUESTION, PRESS)
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()
    await within(detailCard()).findByText("Body of Question about my report")

    await userEvent.click(within(listCard()).getByText("Press inquiry"))

    const card = detailCard()
    expect(await within(card).findByText("Body of Press inquiry")).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Mark read/ })).toBeDisabled()
  })

  it("sends the chosen filter chip to the api", async () => {
    mockChrome({ inbox: inboxPage([PRESS]) })
    apiMock.listMail.mockResolvedValue(mailPage([]))
    mockInboxMessages(PRESS)
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()
    await within(listCard()).findByText("Press inquiry")

    await userEvent.click(screen.getByRole("button", { name: "Unread" }))
    await waitFor(() => expect(apiMock.listInbox).toHaveBeenLastCalledWith({ status: "unread" }))

    await userEvent.click(screen.getByRole("button", { name: "Archived" }))
    await waitFor(() => expect(apiMock.listInbox).toHaveBeenLastCalledWith({ status: "archived" }))
  })

  it("shows Load more when a cursor is returned and fetches the next page with it", async () => {
    mockChrome()
    apiMock.listInbox.mockImplementation(async (params: { cursor?: string }) =>
      params.cursor === "in-2" ? inboxPage([PRESS]) : inboxPage([QUESTION], "in-2"),
    )
    apiMock.listMail.mockResolvedValue(mailPage([]))
    mockInboxMessages(QUESTION, PRESS)
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()
    await within(listCard()).findByText("Question about my report")

    await userEvent.click(screen.getByRole("button", { name: "Load more" }))

    expect(await within(listCard()).findByText("Press inquiry")).toBeInTheDocument()
    expect(apiMock.listInbox).toHaveBeenLastCalledWith({ status: "all", cursor: "in-2" })
  })

  it("opens an inbox: deep link in the Inbox folder", async () => {
    mockChrome({ inbox: inboxPage([QUESTION, PRESS]) })
    apiMock.listMail.mockResolvedValue(mailPage([]))
    mockInboxMessages(QUESTION, PRESS)
    renderWithQuery(<MailPage focusId="inbox:i-2" />)

    expect(screen.getByRole("radio", { name: /Inbox/ })).toHaveAttribute("aria-checked", "true")
    expect(await within(detailCard()).findByText("Body of Press inquiry")).toBeInTheDocument()
    expect(within(detailCard()).queryByText("Body of Question about my report")).not.toBeInTheDocument()
  })
})

import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  GetForwardTemplateDefaultResponse,
  InboundEmailDTO,
  InboundEmailListItemDTO,
  InboxFeedEmailItemDTO,
  InboxFeedItemDTO,
  InboxFeedReplyItemDTO,
  InboxFeedResponse,
  MailListResponse,
  MailStatsResponse,
  MailThreadDTO,
  MailThreadListItemDTO,
} from "@civfix/shared"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { detailCard, listCard } from "@/test/panes"
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

function emailFeedItem(item: InboundEmailListItemDTO) {
  return { ...item, source: "email" } satisfies InboxFeedEmailItemDTO
}

const QUESTION_FEED = emailFeedItem(QUESTION)
const PRESS_FEED = emailFeedItem(PRESS)

const REPORT_REPLY = {
  source: "reply",
  id: "m-1",
  threadId: "t-1",
  reportId: "r-1",
  cleanupId: null,
  org: "Oakland Public Works",
  from: "clerk@oaklandca.gov",
  subject: "Re: Pothole on 5th Ave",
  preview: "Crew is scheduled for Monday",
  ts: TS,
  unread: true,
  threadStatus: "needs_action",
  hasAttachments: false,
  authVerdict: "fail",
  publication: "withheld",
} satisfies InboxFeedReplyItemDTO

const EVENT_REPLY = {
  source: "reply",
  id: "m-2",
  threadId: "t-3",
  reportId: null,
  cleanupId: "c-1",
  org: "Parks Department",
  from: "parks@oaklandca.gov",
  subject: "Re: Lake Merritt cleanup",
  preview: "Gloves will be at the boathouse",
  ts: TS,
  unread: false,
  threadStatus: "replied",
  hasAttachments: false,
  authVerdict: "pass",
  publication: null,
} satisfies InboxFeedReplyItemDTO

const REPORT_REPLY_THREAD = {
  ...thread({
    id: "t-1",
    subject: "Re: Pothole on 5th Ave",
    dir: "in",
    from: "clerk@oaklandca.gov",
    status: "needs_action",
    reportId: "r-1",
  }),
  messages: [
    {
      id: "m-1",
      who: "Oakland Public Works",
      from: "clerk@oaklandca.gov",
      to: "outreach@civfix.org",
      dir: "in",
      body: "Body of Re: Pothole on 5th Ave",
      ts: TS,
      attachments: [],
      authVerdict: "fail",
      publication: "withheld",
    },
  ],
} satisfies MailThreadDTO

function mockThreadDetails(...threads: MailThreadDTO[]) {
  apiMock.getMailThread.mockImplementation(async ({ id }: { id: string }) => {
    const t = threads.find((x) => x.id === id)
    if (!t) throw new Error(`no thread ${id}`)
    return t
  })
}

function feedPage(items: InboxFeedItemDTO[], nextCursor: string | null = null) {
  return { items, nextCursor } satisfies InboxFeedResponse
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
function mockChrome({ feed = feedPage([]) }: { feed?: InboxFeedResponse } = {}) {
  apiMock.getMailStats.mockResolvedValue(STATS)
  apiMock.getForwardTemplateDefault.mockResolvedValue({
    subjectTemplate: null,
    bodyTemplate: null,
    updatedAt: null,
  } satisfies GetForwardTemplateDefaultResponse)
  apiMock.listInboxFeed.mockResolvedValue(feed)
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

  it("replaces a deep-linked thread focusId that is not on the first page with the first row (current behavior)", async () => {
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

  it("switches to the Inbox folder with the feed filter chips and no stats strip", async () => {
    mockChrome()
    apiMock.listMail.mockResolvedValue(mailPage([]))
    renderWithQuery(<MailPage focusId={null} />)
    await screen.findByText("Sent · 7d")
    await openInbox()

    expect(screen.getByRole("radio", { name: /Inbox/ })).toHaveAttribute("aria-checked", "true")
    expect(screen.queryByText("Sent · 7d")).not.toBeInTheDocument()
    for (const chip of ["All", "Unread", "Replies", "Needs review", "Unmatched", "Archived"]) {
      expect(screen.getByRole("button", { name: chip })).toBeInTheDocument()
    }
    for (const chip of ["Inbound", "Outbound", "Needs attention"]) {
      expect(screen.queryByRole("button", { name: chip })).not.toBeInTheDocument()
    }
    expect(within(listCard()).getByRole("heading", { name: "All" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Search sender, subject, org…")).toBeInTheDocument()
  })

  it("shows the loading state while the inbox feed is in flight", async () => {
    mockChrome()
    apiMock.listInboxFeed.mockReturnValue(new Promise(() => {}))
    apiMock.listMail.mockResolvedValue(mailPage([]))
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()
    expect(within(listCard()).getByRole("status")).toHaveTextContent("Loading inbox...")
    expect(within(detailCard()).getByText("No message selected")).toBeInTheDocument()
  })

  it("shows the per-filter empty copy when the inbox feed is empty", async () => {
    mockChrome()
    apiMock.listMail.mockResolvedValue(mailPage([]))
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()
    expect(await within(listCard()).findByText("Inbox is empty")).toBeInTheDocument()
    expect(
      within(listCard()).getByText("City replies and other mail sent to civfix show up here."),
    ).toBeInTheDocument()
    expect(within(detailCard()).getByText("No message selected")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Needs review" }))

    expect(await within(listCard()).findByText("Nothing to review")).toBeInTheDocument()
    expect(
      within(listCard()).getByText("Replies held back from a report chat or event show up here."),
    ).toBeInTheDocument()
  })

  it("shows the error state with the failure message and refetches the feed on retry", async () => {
    mockChrome()
    apiMock.listInboxFeed.mockRejectedValue(new Error("Inbox backend unreachable"))
    apiMock.listMail.mockResolvedValue(mailPage([]))
    mockInboxMessages(PRESS)
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()
    const alert = await within(listCard()).findByRole("alert")
    expect(alert).toHaveTextContent("Could not load this")
    expect(alert).toHaveTextContent("Inbox backend unreachable")

    apiMock.listInboxFeed.mockResolvedValue(feedPage([PRESS_FEED]))
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }))

    expect(await within(listCard()).findByText("Press inquiry")).toBeInTheDocument()
    expect(within(listCard()).queryByRole("alert")).not.toBeInTheDocument()
  })

  it("renders reply and email rows and auto-selects the first item into the reader", async () => {
    mockChrome({ feed: feedPage([REPORT_REPLY, QUESTION_FEED, EVENT_REPLY]) })
    apiMock.listMail.mockResolvedValue(mailPage([]))
    mockThreadDetails(REPORT_REPLY_THREAD)
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()

    await within(listCard()).findByText("Re: Pothole on 5th Ave")
    const list = listCard()
    expect(within(list).getByText("3")).toBeInTheDocument()
    expect(within(list).getByText("Oakland Public Works")).toBeInTheDocument()
    expect(within(list).getByText("Report reply")).toBeInTheDocument()
    expect(within(list).getByText("Withheld")).toBeInTheDocument()
    expect(within(list).getByText("Question about my report")).toBeInTheDocument()
    expect(within(list).getByText("resident@example.com")).toBeInTheDocument()
    expect(within(list).getByText("support")).toBeInTheDocument()
    expect(within(list).getByText("Unread")).toBeInTheDocument()
    expect(within(list).getByText("Re: Lake Merritt cleanup")).toBeInTheDocument()
    expect(within(list).getByText("Parks Department")).toBeInTheDocument()
    expect(within(list).getByText("Event reply")).toBeInTheDocument()
    expect(within(list).getByText("Replied")).toBeInTheDocument()
    expect(apiMock.listInboxFeed).toHaveBeenCalledWith({ filter: "all" })

    const card = detailCard()
    expect(await within(card).findByText("Body of Re: Pothole on 5th Ave")).toBeInTheDocument()
    expect(within(card).getByText("Failed sender check")).toBeInTheDocument()
    expect(within(card).getByText("Withheld")).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Publish reply/ })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /View report/ })).toBeInTheDocument()
    expect(within(card).getByPlaceholderText("Reply to Oakland Public Works…")).toBeInTheDocument()
    expect(apiMock.getMailThread).toHaveBeenCalledWith({ id: "t-1" })
    expect(apiMock.getInboxMessage).not.toHaveBeenCalled()
  })

  it("opens a clicked email row in the inbound message reader", async () => {
    mockChrome({ feed: feedPage([REPORT_REPLY, PRESS_FEED]) })
    apiMock.listMail.mockResolvedValue(mailPage([]))
    mockThreadDetails(REPORT_REPLY_THREAD)
    mockInboxMessages(PRESS)
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()
    await within(detailCard()).findByText("Body of Re: Pothole on 5th Ave")

    await userEvent.click(within(listCard()).getByText("Press inquiry"))

    const card = detailCard()
    expect(await within(card).findByText("Body of Press inquiry")).toBeInTheDocument()
    expect(within(card).getByText("to hello@civfix.org")).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: /Mark read/ })).toBeDisabled()
    expect(within(card).getByRole("button", { name: /Archive/ })).toBeEnabled()
    expect(within(card).queryByRole("button", { name: /Publish reply/ })).not.toBeInTheDocument()
    expect(apiMock.getInboxMessage).toHaveBeenCalledWith({ id: "i-2" })
  })

  it("sends the chosen filter chip and search to listInboxFeed and titles the list with the chip", async () => {
    mockChrome({ feed: feedPage([PRESS_FEED]) })
    apiMock.listMail.mockResolvedValue(mailPage([]))
    mockInboxMessages(PRESS)
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()
    await within(listCard()).findByText("Press inquiry")

    const chips = [
      ["Unread", "unread"],
      ["Replies", "replies"],
      ["Needs review", "review"],
      ["Unmatched", "unmatched"],
      ["Archived", "archived"],
    ] as const
    for (const [label, filter] of chips) {
      await userEvent.click(screen.getByRole("button", { name: label }))
      await waitFor(() => expect(apiMock.listInboxFeed).toHaveBeenLastCalledWith({ filter }))
      expect(within(listCard()).getByRole("heading", { name: label })).toBeInTheDocument()
    }

    await userEvent.type(screen.getByPlaceholderText("Search sender, subject, org…"), "press")
    await waitFor(() =>
      expect(apiMock.listInboxFeed).toHaveBeenLastCalledWith({ filter: "archived", q: "press" }),
    )
  })

  it("shows Load more when a cursor is returned and fetches the next page with it", async () => {
    mockChrome()
    apiMock.listInboxFeed.mockImplementation(async (params: { cursor?: string }) =>
      params.cursor === "feed-2" ? feedPage([PRESS_FEED]) : feedPage([QUESTION_FEED], "feed-2"),
    )
    apiMock.listMail.mockResolvedValue(mailPage([]))
    mockInboxMessages(QUESTION, PRESS)
    renderWithQuery(<MailPage focusId={null} />)
    await openInbox()
    await within(listCard()).findByText("Question about my report")

    await userEvent.click(screen.getByRole("button", { name: "Load more" }))

    expect(await within(listCard()).findByText("Press inquiry")).toBeInTheDocument()
    expect(apiMock.listInboxFeed).toHaveBeenLastCalledWith({ filter: "all", cursor: "feed-2" })
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("opens an inbox: deep link in the Inbox folder", async () => {
    mockChrome({ feed: feedPage([QUESTION_FEED, PRESS_FEED]) })
    apiMock.listMail.mockResolvedValue(mailPage([]))
    mockInboxMessages(QUESTION, PRESS)
    renderWithQuery(<MailPage focusId="inbox:i-2" />)

    expect(screen.getByRole("radio", { name: /Inbox/ })).toHaveAttribute("aria-checked", "true")
    expect(await within(detailCard()).findByText("Body of Press inquiry")).toBeInTheDocument()
    expect(within(detailCard()).queryByText("Body of Question about my report")).not.toBeInTheDocument()
    expect(apiMock.getInboxMessage).not.toHaveBeenCalledWith({ id: "i-1" })
  })
})

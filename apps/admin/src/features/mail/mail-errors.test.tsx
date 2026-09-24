import { readdirSync, readFileSync } from "node:fs"

import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  GetForwardTemplateDefaultResponse,
  InboxFeedResponse,
  MailListResponse,
  MailStatsResponse,
  MailThreadDTO,
} from "@civfix/shared"
import { describe, expect, it, onTestFinished, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { DialogHost } from "@/components/shared/dialog"
import { makeQueryClient } from "@/lib/query"
import { useUiStore, type ToastTone } from "@/store/ui-store"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { detailCard } from "@/test/panes"
import { MailPage } from "@/features/mail/mail-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const TS = "2026-09-20T15:00:00.000Z"

function threadOf(over: Partial<MailThreadDTO>): MailThreadDTO {
  return {
    id: "t-1",
    dir: "in",
    from: "clerk@oaklandca.gov",
    to: "outreach@civfix.org",
    org: "Oakland Public Works",
    subject: "Pothole on 5th Ave",
    preview: "Can your crew take a look?",
    ts: TS,
    unread: false,
    status: "needs_action",
    jurisdictionGeoid: null,
    reportId: null,
    messages: [
      {
        id: "m-1",
        who: "Oakland Public Works",
        from: "clerk@oaklandca.gov",
        to: "outreach@civfix.org",
        dir: "in",
        body: "Can your crew take a look?",
        ts: TS,
        attachments: [],
        authVerdict: "pass",
        publication: null,
      },
    ],
    ...over,
  } satisfies MailThreadDTO
}

function mockPage(detail: MailThreadDTO) {
  apiMock.getMailStats.mockResolvedValue({
    unread: 0,
    threads: 1,
    sent: 1,
    bounced: 0,
    failed: 0,
  } satisfies MailStatsResponse)
  apiMock.getForwardTemplateDefault.mockResolvedValue({
    subjectTemplate: null,
    bodyTemplate: null,
    updatedAt: null,
  } satisfies GetForwardTemplateDefaultResponse)
  apiMock.listInboxFeed.mockResolvedValue({ items: [], nextCursor: null } satisfies InboxFeedResponse)
  const { messages: _messages, ...row } = detail
  apiMock.listMail.mockResolvedValue({ items: [row], nextCursor: null } satisfies MailListResponse)
  apiMock.getMailThread.mockResolvedValue(detail)
}

// The page runs on the app's real query client so the one central mutation error handler is live.
function renderPage(detail: MailThreadDTO) {
  mockPage(detail)
  return renderWithQuery(
    <>
      <MailPage focusId={null} />
      <DialogHost />
    </>,
    makeQueryClient(),
  )
}

function spyToasts() {
  const original = useUiStore.getState().showToast
  const showToast = vi.fn<(text: string, tone?: ToastTone) => void>()
  useUiStore.setState({ showToast })
  onTestFinished(() => useUiStore.setState({ showToast: original }))
  return showToast
}

const REJECTED = new Error("Mail provider rejected the message")

describe("mail mutation failures", () => {
  it("shows one error toast when a reply fails", async () => {
    const toasts = spyToasts()
    apiMock.replyMail.mockRejectedValue(REJECTED)
    renderPage(threadOf({}))
    const reply = await within(detailCard()).findByPlaceholderText("Reply to Oakland Public Works…")

    await userEvent.type(reply, "Thanks")
    await userEvent.click(within(detailCard()).getByRole("button", { name: /^Reply/ }))

    await waitFor(() => expect(toasts).toHaveBeenCalled())
    expect(toasts).toHaveBeenCalledTimes(1)
    expect(toasts).toHaveBeenCalledWith(REJECTED.message, "error")
  })

  it("shows one error toast when Mark replied fails", async () => {
    const toasts = spyToasts()
    apiMock.setMailStatus.mockRejectedValue(REJECTED)
    renderPage(threadOf({}))

    await userEvent.click(await within(detailCard()).findByRole("button", { name: /Mark replied/ }))

    await waitFor(() => expect(toasts).toHaveBeenCalled())
    expect(toasts).toHaveBeenCalledTimes(1)
  })

  it("shows one error toast when a resend fails", async () => {
    const toasts = spyToasts()
    apiMock.resendMail.mockRejectedValue(REJECTED)
    renderPage(threadOf({ status: "bounced" }))

    await userEvent.click(await within(detailCard()).findByRole("button", { name: /Resend/ }))

    await waitFor(() => expect(toasts).toHaveBeenCalled())
    expect(toasts).toHaveBeenCalledTimes(1)
  })

  it("shows one error toast when composing fails", async () => {
    const toasts = spyToasts()
    apiMock.composeMail.mockRejectedValue(REJECTED)
    renderPage(threadOf({}))
    await within(detailCard()).findByText("Can your crew take a look?", { selector: "p" })

    await userEvent.click(screen.getByRole("button", { name: /Compose/ }))
    const dialog = screen.getByRole("dialog", { name: "New message" })
    await userEvent.type(within(dialog).getByLabelText("To"), "works@oaklandca.gov")
    await userEvent.type(within(dialog).getByLabelText("Subject"), "Pothole")
    await userEvent.type(within(dialog).getByLabelText("Message"), "Please take a look")
    await userEvent.click(within(dialog).getByRole("button", { name: /Send/ }))

    await waitFor(() => expect(toasts).toHaveBeenCalled())
    expect(toasts).toHaveBeenCalledTimes(1)
  })

  it("shows one error toast when saving the default template fails", async () => {
    const toasts = spyToasts()
    apiMock.setForwardTemplateDefault.mockRejectedValue(REJECTED)
    renderPage(threadOf({}))
    const opener = screen.getByRole("button", { name: /Default template/ })
    await waitFor(() => expect(opener).toBeEnabled())

    await userEvent.click(opener)
    const dialog = screen.getByRole("dialog", { name: "Default forwarding email" })
    await userEvent.type(within(dialog).getByLabelText("Subject"), "Report forwarded")
    await userEvent.click(within(dialog).getByRole("button", { name: /Save/ }))

    await waitFor(() => expect(toasts).toHaveBeenCalled())
    expect(toasts).toHaveBeenCalledTimes(1)
  })

  it("shows one error toast when publishing a withheld reply fails", async () => {
    const toasts = spyToasts()
    apiMock.publishMailReply.mockRejectedValue(REJECTED)
    const withheld = threadOf({})
    withheld.messages = [{ ...withheld.messages[0]!, authVerdict: "fail", publication: "withheld" }]
    renderPage(withheld)

    await userEvent.click(await within(detailCard()).findByRole("button", { name: /Publish reply/ }))
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Publish reply" }))

    await waitFor(() => expect(toasts).toHaveBeenCalled())
    expect(toasts).toHaveBeenCalledTimes(1)
  })

  it("shows a failed template preview inline, without a toast", async () => {
    const toasts = spyToasts()
    apiMock.previewForwardTemplate.mockRejectedValue(new Error("Preview renderer unavailable"))
    renderPage(threadOf({}))
    const opener = screen.getByRole("button", { name: /Default template/ })
    await waitFor(() => expect(opener).toBeEnabled())

    await userEvent.click(opener)
    const dialog = screen.getByRole("dialog", { name: "Default forwarding email" })
    await userEvent.click(within(dialog).getByRole("button", { name: /Preview/ }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Preview renderer unavailable")
    expect(toasts).not.toHaveBeenCalled()
  })
})

describe("mail and inbox error copy", () => {
  it("routes every rendered error through errorMessage", () => {
    for (const dir of ["./", "../inbox/", "../discovery/"]) {
      const base = new URL(dir, import.meta.url)
      for (const name of readdirSync(base)) {
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue
        const source = readFileSync(new URL(name, base), "utf8")
        expect(source, `${dir}${name}`).not.toMatch(/toAppError\(/)
      }
    }
  })
})
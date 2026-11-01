import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  AppError,
  ErrorCode,
  type AdminDevForceUpdateAccount,
  type AdminDevForceUpdateListResponse,
  type AdminDevOverviewResponse,
} from "@civfix/contract"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { formatDateTime } from "@/lib/dates"
import { apiMock } from "@/test/api-mock"
import { card, openAt, overview, renderDevPage } from "@/test/dev"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const A = "a@civfix.org"
const B = "b@civfix.org"
const OP = "op@civfix.org"
const EXPIRES = "2026-10-21T09:30:00.000Z"

const FORCE = "Force update"
const PUSH = "Test push"
const EMAIL = "Test email"
const RESET = "Reset first run"
const NO_ACCOUNTS = "No test accounts are set up."

function forced(email: string, userId: string): AdminDevForceUpdateAccount {
  return { userId, email, expiresAt: EXPIRES }
}

const A_ROW = forced(A, "00000000-0000-4000-8000-00000000000a")
const B_ROW = forced(B, "00000000-0000-4000-8000-00000000000b")

function list(accounts: AdminDevForceUpdateAccount[]): AdminDevForceUpdateListResponse {
  return { accounts }
}

async function openTestTools(
  overrides: Partial<AdminDevOverviewResponse> = {},
  accounts: AdminDevForceUpdateAccount[] = [],
) {
  apiMock.adminDevOverview.mockResolvedValue(
    overview({ devToolsEnabled: true, testAccounts: [A, B], ...overrides }),
  )
  apiMock.adminDevListForceUpdate.mockResolvedValue(list(accounts))
  openAt("#test-tools")
  const { client } = renderDevPage()
  return { invalidate: vi.spyOn(client, "invalidateQueries") }
}

async function openTools(accounts: AdminDevForceUpdateAccount[] = []) {
  const opened = await openTestTools({}, accounts)
  await screen.findByRole("heading", { name: FORCE, level: 3 })
  return opened
}

/** The server's force-update list after the PUT is what the PUT returns. */
function forceUpdateAnswers(after: AdminDevForceUpdateAccount[]): void {
  apiMock.adminDevSetForceUpdate.mockImplementation(() => {
    apiMock.adminDevListForceUpdate.mockResolvedValue(list(after))
    return Promise.resolve(list(after))
  })
}

function picker(title: string): HTMLElement {
  return within(card(title)).getByRole("combobox", { name: "Test account" })
}

function button(title: string, name: string): HTMLElement {
  return within(card(title)).getByRole("button", { name })
}

async function pick(title: string, email: string): Promise<void> {
  await userEvent.selectOptions(picker(title), email)
}

async function dialogTitled(title: string): Promise<HTMLElement> {
  const dialog = await screen.findByRole("dialog")
  expect(within(dialog).getByRole("heading", { name: title })).toBeInTheDocument()
  return dialog
}

async function answer(dialog: HTMLElement, name: "Change" | "Cancel"): Promise<void> {
  await userEvent.click(within(dialog).getByRole("button", { name }))
}

describe("the Test tools tab", () => {
  it("T16: says only that the tools are off when dev tools are off", async () => {
    await openTestTools({ devToolsEnabled: false, testAccounts: [] })

    const panel = screen.getByRole("tabpanel")
    await waitFor(() => expect(panel.textContent).toBe("Test tools are off in this environment."))
    expect(within(panel).queryAllByRole("button")).toEqual([])
    expect(within(panel).queryAllByRole("textbox")).toEqual([])
    expect(within(panel).queryAllByRole("combobox")).toEqual([])
    expect(apiMock.adminDevListForceUpdate).not.toHaveBeenCalled()
  })

  it("T17: lists the test accounts and offers them in every account card", async () => {
    await openTools()

    expect(card("Test accounts")).toHaveTextContent(A)
    expect(card("Test accounts")).toHaveTextContent(B)
    for (const title of [FORCE, PUSH, EMAIL, RESET]) expect(card(title)).toBeInTheDocument()
    for (const title of [FORCE, PUSH, RESET]) {
      const options = within(picker(title)).getAllByRole("option")
      expect(options.map((option) => option.textContent)).toEqual([A, B])
    }
  })

  it("T18: says no test accounts are set up instead of a picker, and still offers the test email", async () => {
    await openTestTools({ testAccounts: [] })
    await screen.findByRole("heading", { name: FORCE, level: 3 })

    for (const title of [FORCE, PUSH, RESET]) {
      expect(card(title)).toHaveTextContent(NO_ACCOUNTS)
      expect(within(card(title)).queryByRole("combobox")).toBeNull()
    }
    expect(button(EMAIL, "Send to me")).toBeInTheDocument()
  })

  it("T29: shows loading, then the overview's error with a retry and no tool cards", async () => {
    let reject: (error: unknown) => void = () => {}
    apiMock.adminDevOverview.mockReturnValue(
      new Promise((_resolve, rejectOverview) => {
        reject = rejectOverview
      }),
    )
    openAt("#test-tools")
    renderDevPage()

    const panel = screen.getByRole("tabpanel")
    expect(await within(panel).findByRole("status")).toBeInTheDocument()

    reject(new AppError(ErrorCode.INTERNAL, "Overview failed"))
    const alert = await within(panel).findByRole("alert")
    expect(alert).toHaveTextContent("Overview failed")
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument()
    expect(within(panel).queryAllByRole("heading", { level: 3 })).toEqual([])
  })
})

describe("Force update", () => {
  it("T19: lists each forced account with its expiry and Turn off", async () => {
    await openTools([A_ROW])

    const row = await within(card(FORCE)).findByRole("listitem")
    expect(row).toHaveTextContent(A)
    expect(row).toHaveTextContent(formatDateTime(EXPIRES))
    expect(within(row).getByRole("button", { name: "Turn off" })).toBeInTheDocument()
  })

  it("T20: turns it on for the picked account after asking, then refreshes", async () => {
    const { invalidate } = await openTools([A_ROW])
    forceUpdateAnswers([A_ROW, B_ROW])
    await pick(FORCE, B)

    await userEvent.click(button(FORCE, "Turn on"))
    await answer(await dialogTitled(`Force ${B} to update?`), "Cancel")
    expect(apiMock.adminDevSetForceUpdate).not.toHaveBeenCalled()

    await userEvent.click(button(FORCE, "Turn on"))
    await answer(await dialogTitled(`Force ${B} to update?`), "Change")

    await waitFor(() => expect(within(card(FORCE)).getAllByRole("listitem")).toHaveLength(2))
    expect(apiMock.adminDevSetForceUpdate).toHaveBeenCalledWith({ email: B, enabled: true })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "dev"] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "audit"] })
  })

  it("T21: turns it off without asking", async () => {
    await openTools([A_ROW])
    forceUpdateAnswers([])

    const row = await within(card(FORCE)).findByRole("listitem")
    await userEvent.click(within(row).getByRole("button", { name: "Turn off" }))

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(apiMock.adminDevSetForceUpdate).toHaveBeenCalledWith({ email: A, enabled: false })
    await waitFor(() => expect(within(card(FORCE)).queryByRole("listitem")).toBeNull())
  })

  it("T22: shows a refusal in the card", async () => {
    await openTools()
    apiMock.adminDevSetForceUpdate.mockRejectedValue(
      new AppError(ErrorCode.CONFLICT, "At most 20 accounts"),
    )
    await pick(FORCE, B)

    await userEvent.click(button(FORCE, "Turn on"))
    await answer(await screen.findByRole("dialog"), "Change")

    expect(await within(card(FORCE)).findByText("At most 20 accounts")).toBeInTheDocument()
  })
})

describe("Test push", () => {
  it("T23: sends with the API's default title and body when both are empty, without asking", async () => {
    await openTools()
    apiMock.adminDevTestPush.mockResolvedValue({ devices: 0 })
    await pick(PUSH, A)

    await userEvent.click(button(PUSH, "Send"))

    expect(await within(card(PUSH)).findByText("Sent to 0 devices")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(apiMock.adminDevTestPush).toHaveBeenCalledTimes(1)
    expect(apiMock.adminDevTestPush.mock.calls[0]![0]).toStrictEqual({ email: A })
  })

  it("T24: sends the title and body typed, within their limits, and counts the devices", async () => {
    await openTools()
    apiMock.adminDevTestPush
      .mockResolvedValueOnce({ devices: 2 })
      .mockResolvedValueOnce({ devices: 1 })
    const title = within(card(PUSH)).getByRole("textbox", { name: /^Title/ })
    const body = within(card(PUSH)).getByRole("textbox", { name: /^Message/ })
    expect(title).toHaveAttribute("maxlength", "80")
    expect(body).toHaveAttribute("maxlength", "200")
    expect(card(PUSH)).toHaveTextContent("0/80")
    expect(card(PUSH)).toHaveTextContent("0/200")

    await userEvent.type(title, "Hi")
    await userEvent.type(body, "There")
    await userEvent.click(button(PUSH, "Send"))

    expect(await within(card(PUSH)).findByText("Sent to 2 devices")).toBeInTheDocument()
    expect(apiMock.adminDevTestPush).toHaveBeenCalledWith({ email: A, title: "Hi", body: "There" })

    await userEvent.click(button(PUSH, "Send"))
    expect(await within(card(PUSH)).findByText("Sent to 1 device")).toBeInTheDocument()
  })

  it("T25: shows a refusal in the card", async () => {
    await openTools()
    apiMock.adminDevTestPush.mockRejectedValue(
      new AppError(ErrorCode.FORBIDDEN, "Not a test account"),
    )

    await userEvent.click(button(PUSH, "Send"))

    expect(await within(card(PUSH)).findByText("Not a test account")).toBeInTheDocument()
  })
})

describe("Test email", () => {
  it("T26: sends to the operator without asking, then shows a refusal", async () => {
    await openTools()
    apiMock.adminDevTestEmail
      .mockResolvedValueOnce({ to: OP })
      .mockRejectedValueOnce(new AppError(ErrorCode.RATE_LIMITED, "Slow down"))

    await userEvent.click(button(EMAIL, "Send to me"))
    expect(await within(card(EMAIL)).findByText(`Sent to ${OP}`)).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(apiMock.adminDevTestEmail).toHaveBeenCalledWith({})

    await userEvent.click(button(EMAIL, "Send to me"))
    expect(await within(card(EMAIL)).findByText("Slow down")).toBeInTheDocument()
  })
})

describe("Reset first run", () => {
  it("T27: resets the picked account after asking", async () => {
    await openTools()
    apiMock.adminDevResetFirstRun.mockResolvedValue({ userId: A_ROW.userId })
    await pick(RESET, A)

    await userEvent.click(button(RESET, "Reset"))
    await answer(await dialogTitled(`Reset first run for ${A}?`), "Cancel")
    expect(apiMock.adminDevResetFirstRun).not.toHaveBeenCalled()

    await userEvent.click(button(RESET, "Reset"))
    await answer(await dialogTitled(`Reset first run for ${A}?`), "Change")

    expect(await within(card(RESET)).findByText("First run reset")).toBeInTheDocument()
    expect(apiMock.adminDevResetFirstRun).toHaveBeenCalledWith({ email: A })
  })

  it("T28: shows a refusal in the card", async () => {
    await openTools()
    apiMock.adminDevResetFirstRun.mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND, "No account yet"),
    )
    await pick(RESET, A)

    await userEvent.click(button(RESET, "Reset"))
    await answer(await screen.findByRole("dialog"), "Change")

    expect(await within(card(RESET)).findByText("No account yet")).toBeInTheDocument()
  })
})

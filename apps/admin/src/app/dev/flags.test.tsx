import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  AppError,
  ErrorCode,
  RUNTIME_FLAGS,
  type AdminDevEnvironment,
  type AdminListRuntimeFlagsResponse,
  type RuntimeFlagKey,
  type RuntimeFlagStateDTO,
} from "@civfix/contract"
import { afterEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { errorMessage } from "@/lib/error-messages"
import { apiMock } from "@/test/api-mock"
import { NOW, THREE_MIN_AGO, badge, card, env, openAt, renderDevPage } from "@/test/dev"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const KS = "Host messaging kill switch"
const OD = "Outreach digest"
const AUTOFORWARD = "Report auto-forward"
const IOS = "Minimum iOS version"
const AND = "Minimum Android version"
const URL_FLAG = "App Store link (iOS)"
const TXT = "Announcement text"
const LVL = "Announcement style"

const OP = "op@civfix.org"
const OP_ID = "00000000-0000-4000-8000-000000000001"
const VERSION_WARNING = "Phones below this version can't use civfix until they update."

type FlagStates = Partial<Record<RuntimeFlagKey, Partial<RuntimeFlagStateDTO>>>

/** Every flag in registry order, each at its default unless `states` says otherwise. */
function flags(states: FlagStates = {}): AdminListRuntimeFlagsResponse {
  return {
    flags: RUNTIME_FLAGS.map((def) => ({
      key: def.key,
      value: def.default,
      override: null,
      fallback: def.default,
      fallbackSource: "default" as const,
      updatedAt: null,
      updatedBy: null,
      ...states[def.key],
    })),
  }
}

const KS_OVERRIDDEN = {
  host_messaging_kill_switch: {
    value: true,
    override: true,
    fallback: false,
    fallbackSource: "env",
    updatedAt: THREE_MIN_AGO,
    updatedBy: { id: OP_ID, email: OP },
  },
} satisfies FlagStates

const T2_FLAGS = {
  ...KS_OVERRIDDEN,
  outreach_digest_enabled: { value: true, override: null, fallback: true, fallbackSource: "env" },
} satisfies FlagStates

afterEach(() => {
  vi.useRealTimers()
})

async function openFlags(states: FlagStates = {}, environment: AdminDevEnvironment = "staging") {
  env(environment)
  apiMock.adminListRuntimeFlags.mockResolvedValue(flags(states))
  apiMock.adminSetRuntimeFlag.mockImplementation(({ key }: { key: RuntimeFlagKey }) =>
    Promise.resolve(flags().flags.find((flag) => flag.key === key)),
  )
  openAt("#flags")
  const { client } = renderDevPage()
  await screen.findByRole("heading", { name: KS, level: 3 })
  await waitFor(() => expect(badge()).not.toBeNull())
  return { invalidate: vi.spyOn(client, "invalidateQueries") }
}

/** The `<dd>` beside `term` in a flag's card, or null when the card has no such term. */
function shown(label: string, term: string): string | null {
  const dt = within(card(label)).queryByText(term, { selector: "dt" })
  return dt ? (dt.nextElementSibling?.textContent ?? "") : null
}

function flagSwitch(label: string): HTMLElement {
  return within(card(label)).getByRole("switch")
}

function textField(label: string): HTMLInputElement {
  return within(card(label)).getByRole("textbox") as HTMLInputElement
}

function saveButton(label: string): HTMLElement {
  return within(card(label)).getByRole("button", { name: "Save" })
}

function details(dialog: HTMLElement): string[] {
  return within(dialog)
    .queryAllByRole("listitem")
    .map((item) => item.textContent ?? "")
}

async function dialogTitled(title: string): Promise<HTMLElement> {
  const dialog = await screen.findByRole("dialog")
  expect(within(dialog).getByRole("heading", { name: title })).toBeInTheDocument()
  return dialog
}

async function confirmChange(dialog: HTMLElement, label = "Change"): Promise<void> {
  await userEvent.click(within(dialog).getByRole("button", { name: label }))
}

async function saveText(label: string, text: string): Promise<HTMLElement> {
  const field = textField(label)
  await userEvent.clear(field)
  if (text) await userEvent.type(field, text)
  await userEvent.click(saveButton(label))
  return screen.findByRole("dialog")
}

describe("the Flags list", () => {
  it("T1: lists every flag in the API's order with its label and description", async () => {
    await openFlags()

    const headings = within(screen.getByRole("tabpanel")).getAllByRole("heading", { level: 3 })
    expect(headings.map((heading) => heading.textContent)).toEqual(RUNTIME_FLAGS.map((def) => def.label))
    for (const def of RUNTIME_FLAGS) expect(card(def.label)).toHaveTextContent(def.description)
  })

  it("T2: shows each value, its source, and for an override its fallback and who changed it when", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(NOW)
    await openFlags(T2_FLAGS)

    expect(shown(KS, "Value")).toBe("On")
    expect(shown(KS, "Source")).toBe("Override")
    expect(shown(KS, "Fallback")).toBe("Off")
    expect(shown(KS, "Changed by")).toBe(OP)
    expect(shown(KS, "Changed")).toBe("3 min ago")

    expect(shown(OD, "Value")).toBe("On")
    expect(shown(OD, "Source")).toBe("From env")
    expect(shown(OD, "Changed by")).toBeNull()
    expect(card(OD)).not.toHaveTextContent("@")

    expect(shown(LVL, "Value")).toBe("Info")
    expect(shown(LVL, "Source")).toBe("Default")
    expect(shown(IOS, "Value")).toBe("Not set")
    expect(shown(IOS, "Source")).toBe("Default")
  })

  it("T3: edits booleans with a switch, the style with a select, the rest with a field and Save", async () => {
    await openFlags(T2_FLAGS)

    expect(flagSwitch(KS)).toHaveAttribute("aria-checked", "true")
    expect(flagSwitch(OD)).toHaveAttribute("aria-checked", "true")
    expect(flagSwitch(AUTOFORWARD)).toHaveAttribute("aria-checked", "false")

    const style = within(card(LVL)).getByRole("combobox")
    expect(within(style).getAllByRole("option").map((option) => option.textContent)).toEqual(["Info", "Warning"])
    expect(style).toHaveDisplayValue("Info")

    for (const label of [IOS, AND, URL_FLAG, TXT]) {
      expect(textField(label)).toBeInTheDocument()
      expect(saveButton(label)).toBeDisabled()
    }
    expect(card(TXT)).toHaveTextContent("0/200")
    expect(textField(TXT)).toHaveAttribute("maxlength", "200")
    expect(card(URL_FLAG)).toHaveTextContent("https://apps.apple.com/")

    const clears = screen.getAllByRole("button", { name: "Clear override" })
    expect(clears).toHaveLength(1)
    expect(card(KS)).toContainElement(clears[0]!)
  })

  it("T15: shows loading, then the error with a retry that asks again", async () => {
    let reject: (error: unknown) => void = () => {}
    env("staging")
    apiMock.adminListRuntimeFlags.mockReturnValueOnce(
      new Promise((_resolve, rejectList) => {
        reject = rejectList
      }),
    )
    openAt("#flags")
    renderDevPage()

    const panel = screen.getByRole("tabpanel")
    expect(await within(panel).findByRole("status")).toBeInTheDocument()

    apiMock.adminListRuntimeFlags.mockResolvedValue(flags())
    reject(new AppError(ErrorCode.INTERNAL, "Flags query failed"))
    const alert = await within(panel).findByRole("alert")
    expect(alert).toHaveTextContent("Flags query failed")

    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(apiMock.adminListRuntimeFlags).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole("heading", { name: KS, level: 3 })).toBeInTheDocument()
  })
})

describe("changing a flag", () => {
  it("T4: turns a switch on after a plain Change, then refreshes the flags and the audit list", async () => {
    const { invalidate } = await openFlags()

    await userEvent.click(flagSwitch(KS))
    const dialog = await dialogTitled(`Turn on ${KS}?`)
    expect(details(dialog)).toEqual(["Off", "On"])
    const confirm = within(dialog).getByRole("button", { name: "Change" })
    expect(confirm).not.toHaveClass("danger")
    await userEvent.click(confirm)

    await waitFor(() => expect(apiMock.adminListRuntimeFlags).toHaveBeenCalledTimes(2))
    expect(apiMock.adminSetRuntimeFlag).toHaveBeenCalledTimes(1)
    expect(apiMock.adminSetRuntimeFlag).toHaveBeenCalledWith({ key: "host_messaging_kill_switch", value: true })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin", "audit"] })
  })

  it("T5: turns a switch off on production with Change on production in the danger style", async () => {
    await openFlags(KS_OVERRIDDEN, "prod")

    await userEvent.click(flagSwitch(KS))
    const dialog = await dialogTitled(`Turn off ${KS}?`)
    const confirm = within(dialog).getByRole("button", { name: "Change on production" })
    expect(confirm).toHaveClass("btn", "danger")
    await userEvent.click(confirm)

    await waitFor(() =>
      expect(apiMock.adminSetRuntimeFlag).toHaveBeenCalledWith({ key: "host_messaging_kill_switch", value: false }),
    )
  })

  it("T6: Cancel changes nothing", async () => {
    await openFlags()

    await userEvent.click(flagSwitch(KS))
    const dialog = await screen.findByRole("dialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(apiMock.adminSetRuntimeFlag).not.toHaveBeenCalled()
    expect(flagSwitch(KS)).toHaveAttribute("aria-checked", "false")
  })

  it("T7: changes the style by its choice label", async () => {
    await openFlags()

    await userEvent.selectOptions(within(card(LVL)).getByRole("combobox"), "Warning")
    const dialog = await dialogTitled(`Change ${LVL} to Warning?`)
    expect(details(dialog)).toEqual(["Info", "Warning"])
    await confirmChange(dialog)

    await waitFor(() =>
      expect(apiMock.adminSetRuntimeFlag).toHaveBeenCalledWith({ key: "announcement_level", value: "warning" }),
    )
  })

  it("T8: saves text trimmed, counting what is in the field", async () => {
    await openFlags()

    await userEvent.type(textField(TXT), "  Pool closed Monday  ")
    expect(saveButton(TXT)).toBeEnabled()
    expect(card(TXT)).toHaveTextContent("22/200")

    await userEvent.click(saveButton(TXT))
    const dialog = await dialogTitled(`Change ${TXT} to Pool closed Monday?`)
    expect(dialog).not.toHaveTextContent(VERSION_WARNING)
    await confirmChange(dialog)

    await waitFor(() =>
      expect(apiMock.adminSetRuntimeFlag).toHaveBeenCalledWith({
        key: "announcement_text",
        value: "Pool closed Monday",
      }),
    )
  })

  it("T9: warns that older phones are locked out when a minimum version is set", async () => {
    await openFlags()

    const ios = await saveText(IOS, "2.1.0")
    expect(within(ios).getByRole("heading", { name: `Change ${IOS} to 2.1.0?` })).toBeInTheDocument()
    expect(ios).toHaveTextContent(VERSION_WARNING)
    await confirmChange(ios)
    await waitFor(() =>
      expect(apiMock.adminSetRuntimeFlag).toHaveBeenCalledWith({ key: "min_app_version_ios", value: "2.1.0" }),
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    const android = await saveText(AND, "3.0.0")
    expect(within(android).getByRole("heading", { name: `Change ${AND} to 3.0.0?` })).toBeInTheDocument()
    expect(android).toHaveTextContent(VERSION_WARNING)
    await confirmChange(android)
    await waitFor(() =>
      expect(apiMock.adminSetRuntimeFlag).toHaveBeenCalledWith({ key: "min_app_version_android", value: "3.0.0" }),
    )
  })

  it("T10: saves an emptied field as not set", async () => {
    const link = "https://apps.apple.com/app/id1"
    await openFlags({ app_store_url_ios: { value: link, override: link } })

    const dialog = await saveText(URL_FLAG, "")
    expect(within(dialog).getByRole("heading", { name: `Change ${URL_FLAG} to not set?` })).toBeInTheDocument()
    expect(details(dialog)).toEqual([link, "Not set"])
    await confirmChange(dialog)

    await waitFor(() =>
      expect(apiMock.adminSetRuntimeFlag).toHaveBeenCalledWith({ key: "app_store_url_ios", value: null }),
    )
  })

  it("T11: does not warn when a minimum version is set to not set", async () => {
    await openFlags({ min_app_version_ios: { value: "2.0.0", override: "2.0.0" } })

    const dialog = await saveText(IOS, "")
    expect(within(dialog).getByRole("heading", { name: `Change ${IOS} to not set?` })).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent(VERSION_WARNING)
  })

  it("T12: shows a refused value under its field and keeps what was typed", async () => {
    const message = "Must start with https://apps.apple.com/"
    await openFlags()
    apiMock.adminSetRuntimeFlag.mockRejectedValue(new AppError(ErrorCode.VALIDATION, message))

    await confirmChange(await saveText(URL_FLAG, "https://example.com/x"))

    expect(await within(card(URL_FLAG)).findByRole("alert")).toHaveTextContent(message)
    expect(textField(URL_FLAG)).toHaveValue("https://example.com/x")
    expect(apiMock.adminListRuntimeFlags).toHaveBeenCalledTimes(1)
  })

  it("T13: toasts any other refusal on the page", async () => {
    const error = new AppError(ErrorCode.RATE_LIMITED, "Too many changes")
    await openFlags()
    apiMock.adminSetRuntimeFlag.mockRejectedValue(error)

    await userEvent.click(flagSwitch(KS))
    await confirmChange(await screen.findByRole("dialog"))

    await waitFor(() =>
      expect(document.querySelector(".toast-wrap")).toHaveTextContent(errorMessage(error)),
    )
  })

  it.each([
    ["staging", "Change", false],
    ["prod", "Change on production", true],
  ] as const)("T14: clears an override on %s back to its fallback", async (environment, label, danger) => {
    await openFlags(KS_OVERRIDDEN, environment)

    await userEvent.click(within(card(KS)).getByRole("button", { name: "Clear override" }))
    const dialog = await dialogTitled(`Clear the override for ${KS}? It goes back to Off.`)
    expect(details(dialog)).toEqual(["On", "Off"])
    const confirm = within(dialog).getByRole("button", { name: label })
    if (danger) expect(confirm).toHaveClass("danger")
    else expect(confirm).not.toHaveClass("danger")
    await userEvent.click(confirm)

    await waitFor(() => expect(apiMock.adminListRuntimeFlags).toHaveBeenCalledTimes(2))
    expect(apiMock.adminSetRuntimeFlag).toHaveBeenCalledWith({ key: "host_messaging_kill_switch", value: null })
  })
})

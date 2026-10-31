import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  AppError,
  ErrorCode,
  type ActivityItemDTO,
  type AuditListQuery,
  type AuditLogEntryDTO,
} from "@civfix/contract"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { card, env, openAt, renderDevPage } from "@/test/dev"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const AUDIT_TITLE = "Audit log"
const ACTIVITY_TITLE = "Recent activity"

function entry(n: number, overrides: Partial<AuditLogEntryDTO> = {}): AuditLogEntryDTO {
  return {
    id: `00000000-0000-4000-8000-00000000000${n}`,
    actorId: "11111111-1111-4111-8111-111111111111",
    actorName: `Operator ${n}`,
    action: `action.${n}`,
    target: `target:${n}`,
    meta: {},
    createdAt: new Date(Date.UTC(2026, 9, 20, 12, 10 - n)).toISOString(),
    ...overrides,
  } satisfies AuditLogEntryDTO
}

const E1 = entry(1, {
  actorName: "Rudra",
  action: "flag.set",
  target: "flag:host_messaging_enabled",
})
const E2 = entry(2)
const E3 = entry(3)
const E4 = entry(4)

function activity(overrides: Partial<ActivityItemDTO> & { who: string }): ActivityItemDTO {
  return {
    kind: "mod_action",
    what: "Did a thing",
    where: "Admin",
    ts: "1h ago",
    hue: "sky",
    ...overrides,
  } satisfies ActivityItemDTO
}

const A1 = activity({ who: "Rudra", what: "Set a flag", ts: "3m ago" })
const A2 = activity({ who: "Theo", what: "Approved a claim", ts: "2h ago" })

function page<T>(items: T[], nextCursor: string | null = null) {
  return { items, nextCursor }
}

type ActivityMock = typeof apiMock.adminActivity

/** Opens `/dev/#audit` once `listAudit` is set up; activity answers A1 and A2 unless `activity` says otherwise. */
function openAudit(
  activity: (mock: ActivityMock) => void = (mock) => mock.mockResolvedValue(page([A1, A2])),
) {
  env("staging")
  activity(apiMock.adminActivity)
  openAt("#audit")
  renderDevPage()
}

function auditSection(): HTMLElement {
  return card(AUDIT_TITLE)
}

function activitySection(): HTMLElement {
  return card(ACTIVITY_TITLE)
}

function auditTable(): HTMLElement {
  return within(auditSection()).getByRole("table", { name: AUDIT_TITLE })
}

/** The cell texts of each body row, in the order shown. */
function auditRows(): string[][] {
  return within(auditTable())
    .getAllByRole("row")
    .filter((row) => within(row).queryAllByRole("columnheader").length === 0)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    )
}

function targets(): string[] {
  return auditRows().map((cells) => cells[3]!)
}

function auditCall(index: number): AuditListQuery {
  return apiMock.listAudit.mock.calls[index]![0] as AuditListQuery
}

function lastAuditCall(): AuditListQuery {
  return apiMock.listAudit.mock.lastCall![0] as AuditListQuery
}

function loadMore(): HTMLElement | null {
  return within(auditSection()).queryByRole("button", { name: "Load more" })
}

function filter(name: "Action" | "Operator"): HTMLElement {
  return screen.getByRole("textbox", { name: `Filter by ${name.toLowerCase()}` })
}

async function showsTargets(expected: string[]): Promise<void> {
  await waitFor(() => expect(targets()).toEqual(expected))
}

async function typeFilter(name: "Action" | "Operator", text: string, callsBefore: number) {
  await userEvent.type(filter(name), text)
  await waitFor(() => expect(apiMock.listAudit).toHaveBeenCalledTimes(callsBefore + 1))
}

describe("the Audit tab's audit log", () => {
  it("T1: asks for 50 and shows the API's rows newest first in a When, Operator, Action, Target table", async () => {
    apiMock.listAudit.mockResolvedValue(page([E1, E2]))
    openAudit()

    await showsTargets([E1.target, E2.target])
    expect(apiMock.listAudit).toHaveBeenCalledTimes(1)
    expect(auditCall(0)).toStrictEqual({ limit: 50 })

    const headers = within(auditTable())
      .getAllByRole("columnheader")
      .map((header) => header.textContent)
    expect(headers).toEqual(["When", "Operator", "Action", "Target"])

    const [when, operator, action, target] = auditRows()[0]!
    expect([operator, action, target]).toEqual(["Rudra", "flag.set", "flag:host_messaging_enabled"])
    expect(when).not.toBe("")
    const whenCell = within(auditTable()).getAllByRole("cell")[0]!
    expect(whenCell.querySelector("time")).toHaveAttribute("dateTime", E1.createdAt)
    expect(loadMore()).toBeNull()
  })

  it("T2: Load more asks for the next page by cursor and appends it", async () => {
    apiMock.listAudit.mockResolvedValueOnce(page([E1, E2], "c1")).mockResolvedValueOnce(page([E3]))
    openAudit()
    await showsTargets([E1.target, E2.target])

    await userEvent.click(loadMore()!)

    await showsTargets([E1.target, E2.target, E3.target])
    expect(auditCall(1)).toStrictEqual({ limit: 50, cursor: "c1" })
    expect(loadMore()).toBeNull()
  })

  it("T3: the Action filter asks the API for matching actions from the first page", async () => {
    apiMock.listAudit.mockResolvedValueOnce(page([E1, E2])).mockResolvedValueOnce(page([E3]))
    openAudit()
    await showsTargets([E1.target, E2.target])

    await typeFilter("Action", "report.", 1)

    expect(auditCall(1)).toStrictEqual({ limit: 50, action: "report." })
    await showsTargets([E3.target])
  })

  it("T4: the Operator filter asks the API for matching operators from the first page", async () => {
    apiMock.listAudit.mockResolvedValueOnce(page([E1, E2])).mockResolvedValueOnce(page([E4]))
    openAudit()
    await showsTargets([E1.target, E2.target])

    await typeFilter("Operator", "Rudra", 1)

    expect(auditCall(1)).toStrictEqual({ limit: 50, actor: "Rudra" })
    await showsTargets([E4.target])
  })

  it("T5: both filters go to the API together", async () => {
    apiMock.listAudit
      .mockResolvedValueOnce(page([E1, E2]))
      .mockResolvedValueOnce(page([E3]))
      .mockResolvedValueOnce(page([E4]))
    openAudit()
    await showsTargets([E1.target, E2.target])

    await typeFilter("Action", "report.", 1)
    await showsTargets([E3.target])
    await typeFilter("Operator", "Rudra", 2)

    expect(lastAuditCall()).toStrictEqual({ limit: 50, action: "report.", actor: "Rudra" })
    await showsTargets([E4.target])
  })

  it("T6: a filter typed after Load more starts again from the first page", async () => {
    apiMock.listAudit
      .mockResolvedValueOnce(page([E1, E2], "c1"))
      .mockResolvedValueOnce(page([E3]))
      .mockResolvedValueOnce(page([E4]))
    openAudit()
    await showsTargets([E1.target, E2.target])
    await userEvent.click(loadMore()!)
    await showsTargets([E1.target, E2.target, E3.target])
    expect(auditCall(1)).toStrictEqual({ limit: 50, cursor: "c1" })

    await typeFilter("Action", "user.", 2)

    expect(auditCall(2)).not.toHaveProperty("cursor")
    await showsTargets([E4.target])
  })

  it("T7: clearing the Action filter drops it from the request", async () => {
    apiMock.listAudit
      .mockResolvedValueOnce(page([E1, E2]))
      .mockResolvedValueOnce(page([E3]))
      .mockResolvedValueOnce(page([E1]))
    openAudit()
    await showsTargets([E1.target, E2.target])
    await typeFilter("Action", "report.", 1)
    await showsTargets([E3.target])

    await userEvent.clear(filter("Action"))
    await waitFor(() => expect(apiMock.listAudit).toHaveBeenCalledTimes(3))

    expect(auditCall(2)).toStrictEqual({ limit: 50 })
    expect(auditCall(2)).not.toHaveProperty("action")
  })

  it("T8: an entry with no operator name reads Not set", async () => {
    apiMock.listAudit.mockResolvedValue(page([entry(5, { actorName: null })]))
    openAudit()

    await waitFor(() => expect(auditRows()).toHaveLength(1))
    expect(auditRows()[0]![1]).toBe("Not set")
  })

  it("T9: an empty log reads Nothing here yet.", async () => {
    apiMock.listAudit.mockResolvedValue(page([]))
    openAudit()

    expect(await within(auditSection()).findByText("Nothing here yet.")).toBeInTheDocument()
    expect(within(auditSection()).queryByRole("table")).toBeNull()
    expect(loadMore()).toBeNull()
  })

  it("T10: a failed log shows the API's message and Try again, while activity still shows", async () => {
    apiMock.listAudit.mockRejectedValue(new AppError(ErrorCode.INTERNAL, "Audit log unavailable"))
    openAudit()

    const alert = await within(auditSection()).findByRole("alert")
    expect(alert).toHaveTextContent("Audit log unavailable")
    expect(await within(activitySection()).findByText("Set a flag")).toBeInTheDocument()

    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(apiMock.listAudit).toHaveBeenCalledTimes(2))
  })

  it("T11: a log still loading shows a loading status, while activity shows on its own", async () => {
    apiMock.listAudit.mockReturnValue(new Promise(() => {}))
    openAudit()

    expect(await within(auditSection()).findByRole("status")).toBeInTheDocument()
    expect(await within(activitySection()).findByText("Set a flag")).toBeInTheDocument()
    expect(within(auditSection()).getByRole("status")).toBeInTheDocument()
  })
})

describe("the Audit tab's recent activity", () => {
  function activityItems(): HTMLElement[] {
    return within(within(activitySection()).getByRole("list")).getAllByRole("listitem")
  }

  it("T12: asks for the newest 50 once and lists them below the log, with no Load more", async () => {
    apiMock.listAudit.mockResolvedValue(page([E1]))
    openAudit((mock) => mock.mockResolvedValue(page([A1, A2], "x")))

    await waitFor(() => expect(activityItems()).toHaveLength(2))
    expect(apiMock.adminActivity).toHaveBeenCalledTimes(1)
    expect(apiMock.adminActivity.mock.calls[0]![0]).toStrictEqual({ limit: 50 })

    const [first, second] = activityItems()
    expect(first).toHaveTextContent("3m ago")
    expect(first).toHaveTextContent("Rudra")
    expect(first).toHaveTextContent("Set a flag")
    expect(second).toHaveTextContent("Approved a claim")

    expect(
      auditSection().compareDocumentPosition(activitySection()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(within(activitySection()).queryByRole("button", { name: "Load more" })).toBeNull()
  })

  it("T13: no activity reads Nothing here yet.", async () => {
    apiMock.listAudit.mockResolvedValue(page([E1]))
    openAudit((mock) => mock.mockResolvedValue(page([])))

    expect(await within(activitySection()).findByText("Nothing here yet.")).toBeInTheDocument()
  })

  it("T14: failed activity shows the API's message and Try again, while the log still shows", async () => {
    apiMock.listAudit.mockResolvedValue(page([E1, E2]))
    openAudit((mock) =>
      mock.mockRejectedValue(new AppError(ErrorCode.INTERNAL, "Activity unavailable")),
    )

    const alert = await within(activitySection()).findByRole("alert")
    expect(alert).toHaveTextContent("Activity unavailable")
    await showsTargets([E1.target, E2.target])

    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(apiMock.adminActivity).toHaveBeenCalledTimes(2))
  })

  it("T15: activity still loading shows a loading status", async () => {
    apiMock.listAudit.mockResolvedValue(page([E1]))
    openAudit((mock) => mock.mockReturnValue(new Promise(() => {})))

    expect(await within(activitySection()).findByRole("status")).toBeInTheDocument()
  })
})

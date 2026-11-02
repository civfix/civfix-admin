import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  AppError,
  ErrorCode,
  FilingRouteInputSchema,
  type FilingRouteDTO,
  type FilingRouteHealth,
  type JurisdictionDirectoryDTO,
} from "@civfix/contract"

import type * as ApiModule from "@/lib/api"
import { REPORT_CATEGORIES, categoryLabel } from "@/lib/category"
import { preciseDateTimeTitle } from "@/lib/dates"
import { errorMessage } from "@/lib/error-messages"
import { apiMock } from "@/test/api-mock"
import { jurisdiction, mockDetailQueries } from "@/test/discovery"
import { renderWithQuery } from "@/test/render"
import { spyToasts } from "@/test/toasts"
import {
  healthText,
  parseRows,
  routeRows,
  rowErrorsFromError,
  withChannel,
  type RouteRow,
  type RouteRowKey,
} from "@/features/discovery/filing-routes-model"
import { FilingRoutesSection } from "@/features/discovery/filing-routes-section"
import { JurisdictionDetail } from "@/features/discovery/jurisdiction-detail"
import { UnmappedDetail } from "@/features/discovery/unmapped-detail"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

// Leaflet cannot draw in jsdom; the boundary map is irrelevant to the routes card.
vi.mock("@/components/map/boundary-map", () => ({
  BoundaryMap: () => <div data-testid="boundary-map" />,
}))

const NOW = Date.parse("2026-10-24T12:00:00.000Z")
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const before = (ms: number) => new Date(NOW - ms).toISOString()

const PORTAL_URL_MESSAGE = "Portal URL must be a public https URL outside civfix."
const PORTAL_NEEDS_URL_MESSAGE =
  "A portal route needs a form URL, and only a portal route takes one."
const SENDER_MESSAGE = "Sender domain must be a hostname such as lacity.org."
const GMAIL_MESSAGE = "gmail.com can't be a city sender."
const ROUTES_HINT =
  "A category without a route uses Default; with neither, the email contacts above; with no contact, reports go to Needs a human."

const NO_HEALTH: FilingRouteHealth = { lastFiledAt: null, lastFailedAt: null, scriptVersion: null }

function blankRow(key: RouteRowKey): RouteRow {
  return {
    key,
    label: key === "default" ? "Default" : categoryLabel(key),
    channel: "none",
    formUrl: "",
    requestTypeHint: "",
    includeLink: true,
    senders: [],
    enabled: true,
    health: null,
  }
}

function blankRows(): RouteRow[] {
  return [blankRow("default"), ...REPORT_CATEGORIES.map(blankRow)]
}

function rowsWith(...edits: [RouteRowKey, Partial<RouteRow>][]): RouteRow[] {
  return blankRows().map((row) => {
    const edit = edits.find(([key]) => key === row.key)
    return edit ? { ...row, ...edit[1] } : row
  })
}

const VALID_PORTAL: Partial<RouteRow> = {
  channel: "portal",
  formUrl: "https://myla311.lacity.gov/s/",
}

function validation(fields: Record<string, string>): AppError {
  return new AppError(ErrorCode.VALIDATION, "Invalid request", { httpStatus: 400, fields })
}

function routeDTO(overrides: Partial<FilingRouteDTO> = {}): FilingRouteDTO {
  return {
    category: "graffiti",
    channel: "portal",
    formUrl: "https://myla311.lacity.gov/s/",
    requestTypeHint: "Graffiti Removal",
    includeLink: true,
    statusSenderDomains: ["lacity.org"],
    enabled: true,
    health: NO_HEALTH,
    ...overrides,
  } satisfies FilingRouteDTO
}

describe("routeRows", () => {
  it("T13: no routes gives Default then every category, each Not set with the defaults", () => {
    const rows = routeRows([])
    expect(rows.map((row) => row.key)).toEqual(["default", ...REPORT_CATEGORIES])
    expect(rows.map((row) => row.label)).toEqual([
      "Default",
      ...REPORT_CATEGORIES.map(categoryLabel),
    ])
    expect(rows).toEqual(blankRows())
  })

  it("T14: a saved category route fills its row and leaves the others blank", () => {
    const dto = routeDTO({ enabled: false })
    const rows = routeRows([dto])
    expect(rows.find((row) => row.key === "graffiti")).toEqual({
      key: "graffiti",
      label: categoryLabel("graffiti"),
      channel: "portal",
      formUrl: "https://myla311.lacity.gov/s/",
      requestTypeHint: "Graffiti Removal",
      includeLink: true,
      senders: ["lacity.org"],
      enabled: false,
      health: NO_HEALTH,
    })
    expect(rows.filter((row) => row.key !== "graffiti")).toEqual(
      blankRows().filter((row) => row.key !== "graffiti"),
    )
  })

  it("T15: a null category is the default row, and null text fields read empty", () => {
    const rows = routeRows([
      routeDTO({ category: null, channel: "manual", formUrl: null, requestTypeHint: null }),
    ])
    expect(rows[0]).toMatchObject({
      key: "default",
      channel: "manual",
      formUrl: "",
      requestTypeHint: "",
    })
  })
})

describe("parseRows", () => {
  it("T16: a portal row is sent as its parsed input", () => {
    const result = parseRows(
      rowsWith([
        "graffiti",
        {
          channel: "portal",
          formUrl: " https://myla311.lacity.gov/s/ ",
          requestTypeHint: "Graffiti Removal",
          senders: ["lacity.org"],
          includeLink: true,
          enabled: true,
        },
      ]),
    )
    expect(result.rowErrors).toEqual({})
    expect(result.routes).toEqual([
      {
        category: "graffiti",
        channel: "portal",
        formUrl: "https://myla311.lacity.gov/s/",
        requestTypeHint: "Graffiti Removal",
        includeLink: true,
        statusSenderDomains: ["lacity.org"],
        enabled: true,
      },
    ])
  })

  it("T17: a manual default never sends the portal fields left over from an earlier choice", () => {
    const result = parseRows(
      rowsWith([
        "default",
        {
          channel: "manual",
          includeLink: false,
          formUrl: "https://x.lacity.gov/",
          requestTypeHint: "abc",
        },
      ]),
    )
    expect(result.routes).toEqual([
      {
        category: null,
        channel: "manual",
        formUrl: null,
        requestTypeHint: null,
        includeLink: false,
        statusSenderDomains: [],
        enabled: true,
      },
    ])
  })

  it("T18: an email row sends no form URL or hint", () => {
    const result = parseRows(
      rowsWith([
        "graffiti",
        { channel: "email", formUrl: "https://x.lacity.gov/", requestTypeHint: "abc" },
      ]),
    )
    expect(result.routes[0]).toMatchObject({ formUrl: null, requestTypeHint: null })
  })

  it("T19: a blank hint is sent as null", () => {
    const result = parseRows(rowsWith(["graffiti", { ...VALID_PORTAL, requestTypeHint: "   " }]))
    expect(result.routes[0]).toMatchObject({ requestTypeHint: null })
  })

  it("T20: every set row is sent, in row order", () => {
    const result = parseRows(
      rowsWith(
        ["default", { channel: "manual" }],
        ["graffiti", VALID_PORTAL],
        ["hazard", { channel: "email" }],
      ),
    )
    expect(result.routes.map((route) => route.category)).toEqual([null, "graffiti", "hazard"])
  })

  it("T21: all rows Not set sends no routes", () => {
    const result = parseRows(blankRows())
    expect(result.routes).toEqual([])
    expect(result.rowErrors).toEqual({})
  })

  it("T22: the parsed sender domains are what is sent", () => {
    const result = parseRows(rowsWith(["graffiti", { channel: "email", senders: ["LACity.org"] }]))
    expect(result.routes[0]).toMatchObject({ statusSenderDomains: ["lacity.org"] })
  })

  it("T23: an http start URL is refused on its row", () => {
    const result = parseRows(
      rowsWith(["graffiti", { channel: "portal", formUrl: "http://myla311.lacity.gov/s/" }]),
    )
    expect(result.rowErrors).toEqual({ graffiti: PORTAL_URL_MESSAGE })
  })

  it("T24: an IP-address start URL is refused", () => {
    const result = parseRows(
      rowsWith(["graffiti", { channel: "portal", formUrl: "https://10.0.0.1/" }]),
    )
    expect(result.rowErrors.graffiti).toBe(PORTAL_URL_MESSAGE)
  })

  it("T25: a localhost start URL is refused", () => {
    const result = parseRows(
      rowsWith(["graffiti", { channel: "portal", formUrl: "https://localhost/" }]),
    )
    expect(result.rowErrors.graffiti).toBe(PORTAL_URL_MESSAGE)
  })

  it("T26: a portal row with no start URL is refused", () => {
    const result = parseRows(rowsWith(["graffiti", { channel: "portal", formUrl: "" }]))
    expect(result.rowErrors.graffiti).toBe(PORTAL_NEEDS_URL_MESSAGE)
  })

  it("T27: a sender chip that is not a hostname is refused", () => {
    const result = parseRows(rowsWith(["graffiti", { channel: "email", senders: ["lacity"] }]))
    expect(result.rowErrors.graffiti).toBe(SENDER_MESSAGE)
  })

  it("T28: a hint over 200 characters gets the schema's first message; 200 is fine", () => {
    const long = "a".repeat(201)
    const expected = FilingRouteInputSchema.safeParse({
      category: "graffiti",
      channel: "portal",
      formUrl: "https://myla311.lacity.gov/s/",
      requestTypeHint: long,
      includeLink: true,
      statusSenderDomains: [],
      enabled: true,
    }).error?.issues[0]?.message
    expect(expected).toEqual(expect.any(String))
    expect(
      parseRows(rowsWith(["graffiti", { ...VALID_PORTAL, requestTypeHint: long }])).rowErrors
        .graffiti,
    ).toBe(expected)
    expect(
      parseRows(rowsWith(["graffiti", { ...VALID_PORTAL, requestTypeHint: "a".repeat(200) }]))
        .rowErrors,
    ).toEqual({})
  })

  it("T29: only the failing row gets an error", () => {
    const result = parseRows(
      rowsWith(
        ["default", { channel: "portal", formUrl: "http://a.gov/" }],
        ["graffiti", { channel: "email", senders: ["lacity.org"] }],
      ),
    )
    expect(result.rowErrors).toEqual({ default: PORTAL_URL_MESSAGE })
  })
})

describe("withChannel", () => {
  const JURISDICTION_FORM = "https://myla311.lacity.gov/"

  it("T30: switching to Portal pre-fills an empty start URL from the jurisdiction's form URL", () => {
    const row = withChannel(blankRow("graffiti"), "portal", JURISDICTION_FORM)
    expect(row).toMatchObject({ channel: "portal", formUrl: JURISDICTION_FORM })
  })

  it("T31: a start URL already typed is kept", () => {
    const row = withChannel(
      { ...blankRow("graffiti"), formUrl: "https://other.lacity.gov/" },
      "portal",
      JURISDICTION_FORM,
    )
    expect(row.formUrl).toBe("https://other.lacity.gov/")
  })

  it("T32: with no jurisdiction form URL the start URL stays empty", () => {
    expect(withChannel(blankRow("graffiti"), "portal", null).formUrl).toBe("")
  })

  it("T33: switching to another channel does not pre-fill", () => {
    const row = withChannel(blankRow("graffiti"), "email", JURISDICTION_FORM)
    expect(row).toMatchObject({ channel: "email", formUrl: "" })
  })
})

describe("healthText", () => {
  it("T34: a route with no outcomes was never used", () => {
    expect(healthText(NO_HEALTH, NOW)).toBe("Never used")
  })

  it("T35: every part present", () => {
    expect(
      healthText(
        {
          lastFiledAt: before(2 * HOUR),
          lastFailedAt: before(3 * DAY),
          scriptVersion: "a1b2c3d4e5f6",
        },
        NOW,
      ),
    ).toBe("Last filed 2 h ago · Last failed 3 d ago · script a1b2c3d4e5f6")
  })

  it("T36: only a failure", () => {
    expect(healthText({ ...NO_HEALTH, lastFailedAt: before(5 * MINUTE) }, NOW)).toBe(
      "Last failed 5 min ago",
    )
  })

  it("T37: only a script version", () => {
    expect(healthText({ ...NO_HEALTH, scriptVersion: "a1b2c3d4e5f6" }, NOW)).toBe(
      "script a1b2c3d4e5f6",
    )
  })

  it("T38: a filing just now and a script version", () => {
    expect(
      healthText(
        { ...NO_HEALTH, lastFiledAt: before(30 * SECOND), scriptVersion: "a1b2c3d4e5f6" },
        NOW,
      ),
    ).toBe("Last filed just now · script a1b2c3d4e5f6")
  })
})

describe("rowErrorsFromError", () => {
  it("T39: a field error lands on the row sent at its index", () => {
    expect(
      rowErrorsFromError(validation({ "routes.1.statusSenderDomains": GMAIL_MESSAGE }), [
        "default",
        "graffiti",
      ]),
    ).toEqual({ rows: { graffiti: GMAIL_MESSAGE }, general: null })
  })

  it("T40: index 0 is the first row sent", () => {
    expect(
      rowErrorsFromError(validation({ "routes.0.formUrl": "m" }), ["default", "graffiti"]),
    ).toEqual({
      rows: { default: "m" },
      general: null,
    })
  })

  it("T41: a nested path still maps by the route index", () => {
    expect(
      rowErrorsFromError(validation({ "routes.0.statusSenderDomains.2": "bad" }), ["graffiti"]),
    ).toEqual({
      rows: { graffiti: "bad" },
      general: null,
    })
  })

  it("T42: an error on the whole list is general", () => {
    const raw = validation({
      routes: "Each category may have one route, and the jurisdiction one default.",
    })
    expect(rowErrorsFromError(raw, ["default", "graffiti"])).toEqual({
      rows: {},
      general: errorMessage(raw),
    })
  })

  it("T43: an index that was not sent is general", () => {
    const raw = validation({ "routes.5.formUrl": "m" })
    expect(rowErrorsFromError(raw, ["graffiti"])).toEqual({ rows: {}, general: errorMessage(raw) })
  })

  it("T44: any other error is general", () => {
    const conflict = new AppError(ErrorCode.CONFLICT, "Conflict", { httpStatus: 409 })
    expect(rowErrorsFromError(conflict, ["graffiti"])).toEqual({
      rows: {},
      general: errorMessage(conflict),
    })
    const offline = new TypeError("Failed to fetch")
    expect(rowErrorsFromError(offline, ["graffiti"])).toEqual({
      rows: {},
      general: errorMessage(offline),
    })
  })
})

const LA = jurisdiction()

const UNMAPPED = jurisdiction({
  geoid: "__unmapped__",
  org: "Unmapped",
  layer: "place",
  population: 0,
})

const ROW_LABELS = ["Default", ...REPORT_CATEGORIES.map(categoryLabel)]

function routeRow(label: string): HTMLElement {
  return screen.getByRole("group", { name: `${label} route` })
}

function graffitiRow(): HTMLElement {
  return routeRow(categoryLabel("graffiti"))
}

function routeGroups(): HTMLElement[] {
  return screen
    .queryAllByRole("group")
    .filter((group) => / route$/.test(group.getAttribute("aria-label") ?? ""))
}

function routesCard(): HTMLElement {
  const card = screen.getByText("Filing routes").closest(".sub")
  if (!(card instanceof HTMLElement)) throw new Error("no Filing routes card")
  return card
}

async function rowsLoaded(): Promise<void> {
  await waitFor(() => expect(routeGroups()).toHaveLength(ROW_LABELS.length))
}

async function chooseChannel(row: HTMLElement, channel: "Not set" | "Email" | "Portal" | "Manual") {
  await userEvent.selectOptions(within(row).getByLabelText("Channel"), channel)
}

async function renderSection(dto: JurisdictionDirectoryDTO = LA, routes: FilingRouteDTO[] = []) {
  apiMock.listFilingRoutes.mockResolvedValue({ routes })
  const view = renderWithQuery(<FilingRoutesSection dto={dto} />)
  await rowsLoaded()
  return view
}

async function renderDetail(routes: FilingRouteDTO[] = []) {
  mockDetailQueries()
  apiMock.listFilingRoutes.mockResolvedValue({ routes })
  const view = renderWithQuery(<JurisdictionDetail dto={LA} />)
  await rowsLoaded()
  return view
}

describe("Filing routes card", () => {
  beforeEach(() => {
    // Only Date is faked: the queries and user events keep their real timers.
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("T45: the mapped detail shows the card after the email template, with every row Not set", async () => {
    await renderDetail()
    const column = screen.getByText("Email template").closest(".rep-col")
    if (!(column instanceof HTMLElement)) throw new Error("no right column")
    const heads = [...column.querySelectorAll(".sub-head")].map((head) => head.textContent)
    expect(heads.indexOf("Filing routes")).toBe(heads.indexOf("Email template") + 1)
    expect(routeGroups().map((group) => group.getAttribute("aria-label"))).toEqual(
      ROW_LABELS.map((label) => `${label} route`),
    )
    for (const group of routeGroups()) {
      expect(within(group).getByLabelText("Channel")).toHaveDisplayValue("Not set")
    }
  })

  it("T46: the Unmapped detail has no routes", () => {
    renderWithQuery(<UnmappedDetail dto={UNMAPPED} />)
    expect(screen.queryByText("Filing routes")).not.toBeInTheDocument()
    expect(apiMock.listFilingRoutes).not.toHaveBeenCalled()
  })

  it("T47: the routes load once for the jurisdiction", async () => {
    await renderSection()
    expect(apiMock.listFilingRoutes).toHaveBeenCalledTimes(1)
    expect(apiMock.listFilingRoutes).toHaveBeenCalledWith({ geoid: LA.geoid })
  })

  it("T48: while the routes load, the card shows a loading state and the rest of the detail renders", async () => {
    mockDetailQueries()
    apiMock.listFilingRoutes.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<JurisdictionDetail dto={LA} />)
    expect(await within(routesCard()).findByRole("status")).toBeInTheDocument()
    expect(screen.getByText("Default contact")).toBeInTheDocument()
    expect(screen.getByText("Email template")).toBeInTheDocument()
    expect(routeGroups()).toHaveLength(0)
  })

  it("T49: with the backend off the card shows the error with Retry, and Retry loads the rows", async () => {
    mockDetailQueries()
    const offline = new TypeError("Failed to fetch")
    apiMock.listFilingRoutes.mockRejectedValueOnce(offline).mockResolvedValue({ routes: [] })
    renderWithQuery(<JurisdictionDetail dto={LA} />)

    const card = routesCard()
    expect(await within(card).findByText(errorMessage(offline))).toBeInTheDocument()
    expect(routeGroups()).toHaveLength(0)
    expect(screen.getByText("Default contact")).toBeInTheDocument()

    await userEvent.click(within(card).getByRole("button", { name: "Retry" }))
    await rowsLoaded()
    expect(apiMock.listFilingRoutes).toHaveBeenCalledTimes(2)
  })

  it("T50: the start URL and hint show for Portal only", async () => {
    await renderSection()
    const row = graffitiRow()
    const portalFields = () => [
      within(row).queryByLabelText("Start URL"),
      within(row).queryByLabelText("Request type hint"),
    ]
    expect(portalFields()).toEqual([null, null])
    await chooseChannel(row, "Portal")
    for (const field of portalFields()) expect(field).toBeInTheDocument()
    for (const channel of ["Email", "Manual", "Not set"] as const) {
      await chooseChannel(row, channel)
      expect(portalFields()).toEqual([null, null])
    }
  })

  it("T51: switching to Portal pre-fills the start URL from the jurisdiction's form URL", async () => {
    await renderSection(jurisdiction({ form: "https://myla311.lacity.gov/" }))
    const row = graffitiRow()
    await chooseChannel(row, "Portal")
    expect(within(row).getByLabelText("Start URL")).toHaveValue("https://myla311.lacity.gov/")
  })

  it("T52: five sender chips fill the list, and removing one frees the input", async () => {
    const senders = ["a.lacity.org", "b.lacity.org", "c.lacity.org", "d.lacity.org", "e.lacity.org"]
    await renderSection(LA, [
      routeDTO({
        channel: "email",
        formUrl: null,
        requestTypeHint: null,
        statusSenderDomains: senders,
      }),
    ])
    const row = graffitiRow()
    const chips = () => [...row.querySelectorAll(".fchip")]
    expect(chips()).toHaveLength(5)
    for (const chip of chips()) expect(chip.querySelector(".btn")).not.toBeNull()

    const input = within(row).getByLabelText("City email senders")
    expect(input).toBeDisabled()
    await userEvent.type(input, "f.lacity.org{Enter}")
    expect(chips()).toHaveLength(5)

    await userEvent.click(within(row).getByRole("button", { name: "Remove c.lacity.org" }))
    expect(chips()).toHaveLength(4)
    expect(input).toBeEnabled()
  })

  it("T53: an http start URL is refused on its row and nothing is sent", async () => {
    await renderSection()
    const row = graffitiRow()
    await chooseChannel(row, "Portal")
    await userEvent.type(within(row).getByLabelText("Start URL"), "http://myla311.lacity.gov/s/")
    await userEvent.click(screen.getByRole("button", { name: "Save routes" }))
    expect(within(row).getByText(PORTAL_URL_MESSAGE)).toBeInTheDocument()
    expect(apiMock.saveFilingRoutes).toHaveBeenCalledTimes(0)
  })

  it("T54: Save routes sends the set rows once, toasts, and reloads the rows from the response", async () => {
    const toast = spyToasts()
    await renderSection()
    const defaultRow = routeRow("Default")
    await chooseChannel(defaultRow, "Manual")
    await userEvent.click(within(defaultRow).getByRole("checkbox", { name: "Include CivFix link" }))
    const row = graffitiRow()
    await chooseChannel(row, "Portal")
    await userEvent.type(within(row).getByLabelText("Start URL"), "https://myla311.lacity.gov/s/")
    await userEvent.type(within(row).getByLabelText("Request type hint"), "Graffiti Removal")
    await userEvent.type(within(row).getByLabelText("City email senders"), "lacity.org{Enter}")

    const defaultRoute = {
      category: null,
      channel: "manual" as const,
      formUrl: null,
      requestTypeHint: null,
      includeLink: false,
      statusSenderDomains: [],
      enabled: true,
    }
    const graffitiRoute = {
      category: "graffiti" as const,
      channel: "portal" as const,
      formUrl: "https://myla311.lacity.gov/s/",
      requestTypeHint: "Graffiti Removal",
      includeLink: true,
      statusSenderDomains: ["lacity.org"],
      enabled: true,
    }
    apiMock.saveFilingRoutes.mockResolvedValue({
      routes: [
        { ...defaultRoute, health: NO_HEALTH },
        { ...graffitiRoute, health: NO_HEALTH },
      ],
    })
    await userEvent.click(screen.getByRole("button", { name: "Save routes" }))

    await waitFor(() => expect(toast).toHaveBeenCalledWith("Routes saved", "ok"))
    expect(apiMock.saveFilingRoutes).toHaveBeenCalledTimes(1)
    expect(apiMock.saveFilingRoutes).toHaveBeenCalledWith({
      geoid: LA.geoid,
      routes: [defaultRoute, graffitiRoute],
    })
    await waitFor(() => expect(within(defaultRow).getByText("Never used")).toBeInTheDocument())
    expect(within(graffitiRow()).getByText("Never used")).toBeInTheDocument()
    for (const label of ROW_LABELS.filter(
      (l) => l !== "Default" && l !== categoryLabel("graffiti"),
    )) {
      expect(within(routeRow(label)).queryByText("Never used")).not.toBeInTheDocument()
    }
  })

  it("T55: a saved row switched to Not set is left out, which deletes its route", async () => {
    await renderSection(LA, [routeDTO()])
    await chooseChannel(graffitiRow(), "Not set")
    apiMock.saveFilingRoutes.mockResolvedValue({ routes: [] })
    await userEvent.click(screen.getByRole("button", { name: "Save routes" }))
    await waitFor(() => expect(apiMock.saveFilingRoutes).toHaveBeenCalledTimes(1))
    const sent = apiMock.saveFilingRoutes.mock.calls[0]?.[0] as {
      routes: { category: string | null }[]
    }
    expect(sent.routes.map((route) => route.category)).not.toContain("graffiti")
  })

  it("T56: Save routes never saves the contacts, the note or the handle", async () => {
    await renderDetail()
    await chooseChannel(graffitiRow(), "Email")
    await userEvent.type(
      screen.getByRole("textbox", { name: "Note for the next operator" }),
      "Called the city",
    )
    await userEvent.type(
      screen.getByRole("textbox", { name: "Jurisdiction discussion handle" }),
      "la",
    )
    await userEvent.type(
      screen.getByRole("textbox", { name: `${categoryLabel("trash")} contact email` }),
      "trash@lacity.org",
    )
    apiMock.saveFilingRoutes.mockResolvedValue({ routes: [] })
    await userEvent.click(screen.getByRole("button", { name: "Save routes" }))
    await waitFor(() => expect(apiMock.saveFilingRoutes).toHaveBeenCalledTimes(1))
    expect(apiMock.saveJurisdictionContacts).toHaveBeenCalledTimes(0)
    expect(apiMock.patchJurisdiction).toHaveBeenCalledTimes(0)
  })

  it("T57: Save draft and Save & route never save routes", async () => {
    await renderDetail()
    await chooseChannel(graffitiRow(), "Email")
    await userEvent.type(
      screen.getByRole("textbox", { name: `${categoryLabel("trash")} contact email` }),
      "trash@lacity.org",
    )
    apiMock.patchJurisdiction.mockResolvedValue({ ok: true })
    apiMock.saveJurisdictionContacts.mockResolvedValue({ ok: true })

    await userEvent.click(screen.getByRole("button", { name: "Save draft" }))
    await waitFor(() => expect(apiMock.patchJurisdiction).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole("button", { name: /Save & route/ })).toBeEnabled())
    await userEvent.click(screen.getByRole("button", { name: /Save & route/ }))
    await waitFor(() => expect(apiMock.saveJurisdictionContacts).toHaveBeenCalledTimes(1))
    expect(apiMock.saveFilingRoutes).toHaveBeenCalledTimes(0)
  })

  it("T58: the API's refusal of a sender shows on the row it was sent as", async () => {
    const toast = spyToasts()
    await renderSection()
    await chooseChannel(routeRow("Default"), "Manual")
    const row = graffitiRow()
    await chooseChannel(row, "Email")
    await userEvent.type(within(row).getByLabelText("City email senders"), "gmail.com{Enter}")
    apiMock.saveFilingRoutes.mockRejectedValue(
      validation({ "routes.1.statusSenderDomains": GMAIL_MESSAGE }),
    )
    await userEvent.click(screen.getByRole("button", { name: "Save routes" }))

    expect(await within(row).findByText(GMAIL_MESSAGE)).toBeInTheDocument()
    for (const alert of screen.getAllByRole("alert")) expect(row).toContainElement(alert)
    expect(toast).not.toHaveBeenCalledWith("Routes saved", expect.anything())
  })

  it("T59: any other save error shows above the Save routes button", async () => {
    await renderSection()
    await chooseChannel(graffitiRow(), "Email")
    const conflict = new AppError(ErrorCode.CONFLICT, "Routes changed meanwhile", {
      httpStatus: 409,
    })
    apiMock.saveFilingRoutes.mockRejectedValue(conflict)
    const save = screen.getByRole("button", { name: "Save routes" })
    await userEvent.click(save)

    const message = await screen.findByText(errorMessage(conflict))
    expect(message.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for (const group of routeGroups())
      expect(within(group).queryByRole("alert")).not.toBeInTheDocument()
  })

  it("T60: the fallback hint shows under the rows", async () => {
    await renderSection()
    const hint = screen.getByText(ROUTES_HINT)
    const lastRow = routeGroups().at(-1)
    expect(lastRow?.compareDocumentPosition(hint)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it("T61: a health time carries the exact time as its hover title", async () => {
    const lastFiledAt = before(2 * HOUR)
    await renderSection(LA, [routeDTO({ health: { ...NO_HEALTH, lastFiledAt } })])
    expect(within(graffitiRow()).getByText("2 h ago")).toHaveAttribute(
      "title",
      preciseDateTimeTitle(lastFiledAt),
    )
  })

  it("T62: a Save draft refetch does not replace unsaved route edits", async () => {
    const { client } = await renderDetail()
    await chooseChannel(graffitiRow(), "Email")
    await userEvent.type(
      screen.getByRole("textbox", { name: "Note for the next operator" }),
      "Called the city",
    )
    apiMock.patchJurisdiction.mockResolvedValue({ ok: true })
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }))

    await waitFor(() => expect(apiMock.listFilingRoutes).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(within(graffitiRow()).getByLabelText("Channel")).toHaveDisplayValue("Email")
  })
})

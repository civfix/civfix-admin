import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type {
  GetForwardTemplateDefaultResponse,
  JurisdictionDirectoryDTO,
  JurisdictionDirectoryResponse,
  JurisdictionGeometryResponse,
} from "@civfix/shared"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"
import { DiscoveryPage } from "@/features/discovery/discovery-page"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

// Leaflet cannot draw in jsdom; the boundary map is irrelevant to the list/detail states pinned here.
vi.mock("@/components/map/boundary-map", () => ({
  BoundaryMap: () => <div data-testid="boundary-map" />,
}))

const DAY_MS = 24 * 60 * 60 * 1000

function jurisdiction(overrides: Partial<JurisdictionDirectoryDTO> = {}): JurisdictionDirectoryDTO {
  return {
    geoid: "0644000",
    org: "Los Angeles",
    dept: null,
    email: null,
    form: null,
    method: "none",
    status: "pending",
    coverage: "City limits",
    lastRouted: null,
    layer: "place",
    population: 3_898_747,
    reportsWaiting: 4,
    perCategoryCounts: { trash: 3, graffiti: 1 },
    contacts: [],
    flaggedAt: null,
    handle: null,
    oldestReportAt: new Date(Date.now() - 3 * DAY_MS).toISOString(),
    forwardSubjectTemplate: null,
    forwardBodyTemplate: null,
    ...overrides,
  } satisfies JurisdictionDirectoryDTO
}

const LA = jurisdiction()
const PASADENA = jurisdiction({
  geoid: "0656000",
  org: "Pasadena",
  method: "email",
  status: "verified",
  email: "reports@pasadena.gov",
  population: 138_699,
  reportsWaiting: 0,
  perCategoryCounts: {},
  contacts: [{ category: "trash", email: "trash@pasadena.gov" }],
  oldestReportAt: null,
  lastRouted: "2026-09-01T12:00:00.000Z",
})

function page(
  items: JurisdictionDirectoryDTO[],
  extra: Partial<JurisdictionDirectoryResponse> = {},
): JurisdictionDirectoryResponse {
  return {
    items,
    nextCursor: null,
    total: items.length,
    facets: { routed: 12, unrouted: items.length },
    ...extra,
  } satisfies JurisdictionDirectoryResponse
}

const GEOMETRY = {
  geoid: "0644000",
  layer: "place",
  geometry: { type: "Polygon", coordinates: [] },
  bbox: [-118.7, 33.7, -118.1, 34.3],
  point: { lat: 34.05, lng: -118.25 },
} as unknown as JurisdictionGeometryResponse

function mockDetailQueries(): void {
  apiMock.getJurisdictionGeometry.mockResolvedValue(GEOMETRY)
  apiMock.getForwardTemplateDefault.mockResolvedValue({
    subjectTemplate: null,
    bodyTemplate: null,
    updatedAt: null,
  } satisfies GetForwardTemplateDefaultResponse)
}

function listCalls(): Record<string, unknown>[] {
  return apiMock.listJurisdictions.mock.calls.map((call) => call[0] as Record<string, unknown>)
}

function chip(name: RegExp): HTMLElement {
  return screen.getByRole("button", { name })
}

describe("DiscoveryPage", () => {
  it("shows the loading state while the directory is in flight", async () => {
    apiMock.listJurisdictions.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<DiscoveryPage focusId={null} />)

    expect(await screen.findByRole("status")).toHaveTextContent("Loading jurisdictions…")
    expect(chip(/^Needs mapping/)).toHaveTextContent("Loading…")
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Loading… jurisdictions")
    expect(screen.getByText("No jurisdiction selected")).toBeInTheDocument()
  })

  it("requests the needs-mapping view oldest-first by default, with the sort locked", async () => {
    apiMock.listJurisdictions.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<DiscoveryPage focusId={null} />)

    await waitFor(() => expect(apiMock.listJurisdictions).toHaveBeenCalled())
    // The list and the needs-mapping count share one query key, so one request serves both.
    expect(listCalls()).toEqual([{ filter: "needs_mapping", sort: "oldest", limit: 50 }])
    expect(screen.getByRole("combobox", { name: "Sort jurisdictions" })).toBeDisabled()
    expect(screen.getByRole("combobox", { name: "Sort jurisdictions" })).toHaveValue("oldest")
  })

  it("shows the empty state when nothing matches", async () => {
    apiMock.listJurisdictions.mockResolvedValue(page([], { total: 0, facets: { routed: 0, unrouted: 0 } }))
    renderWithQuery(<DiscoveryPage focusId={null} />)

    expect(await screen.findByText("Nothing matches")).toBeInTheDocument()
    expect(screen.getByText("Try a different filter or search.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("0 jurisdictions")
    expect(screen.getByText("No jurisdiction selected")).toBeInTheDocument()
    expect(screen.getByText("Pick a place from the list.")).toBeInTheDocument()
  })

  it("shows the error message with a retry that refetches", async () => {
    apiMock.listJurisdictions.mockRejectedValue(new Error("directory is down"))
    renderWithQuery(<DiscoveryPage focusId={null} />)

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Could not load this")
    expect(alert).toHaveTextContent("directory is down")
    expect(chip(/^Needs mapping/)).toHaveTextContent(/\u2014/)

    apiMock.listJurisdictions.mockResolvedValue(page([LA]))
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("heading", { level: 2, name: "Los Angeles" })).toBeInTheDocument()
  })

  it("renders rows and auto-selects the first one into the detail pane", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA, PASADENA], { total: 2 }))
    renderWithQuery(<DiscoveryPage focusId={null} />)

    const laRow = await screen.findByRole("button", { name: /^Los Angeles/ })
    expect(laRow).toHaveTextContent("City")
    expect(laRow).toHaveTextContent("Needs contact")
    expect(laRow).toHaveTextContent("0644000")
    expect(laRow).toHaveTextContent("3899k pop")
    expect(laRow).toHaveTextContent("4 waiting")
    expect(laRow).toHaveTextContent("City limits")
    expect(laRow).toHaveTextContent("3d")

    const pasadenaRow = screen.getByRole("button", { name: /^Pasadena/ })
    expect(pasadenaRow).toHaveTextContent("Routed")
    expect(pasadenaRow).toHaveTextContent("139k pop")

    expect(chip(/^Needs mapping/)).toHaveTextContent("2")
    expect(chip(/^Routed/)).toHaveTextContent("12")
    expect(chip(/^All/)).toHaveTextContent("14")
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("2 jurisdictions")

    expect(screen.getByRole("heading", { level: 2, name: "Los Angeles" })).toBeInTheDocument()
    expect(screen.getByText("City · Jurisdiction · GEOID 0644000")).toBeInTheDocument()
    expect(screen.getByText("3,898,747")).toBeInTheDocument()
    expect(screen.getByText("US Census ACS")).toBeInTheDocument()
    expect(screen.getByText("2 types with no contact")).toBeInTheDocument()
    expect(screen.getByText("0 of 7 contacts set")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Save & route/ })).toBeDisabled()
    expect(await screen.findByTestId("boundary-map")).toBeInTheDocument()
    expect(apiMock.getJurisdictionGeometry).toHaveBeenCalledWith({ geoid: "0644000" })
  })

  it("opens the clicked row in the detail pane", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA, PASADENA], { total: 2 }))
    renderWithQuery(<DiscoveryPage focusId={null} />)

    await userEvent.click(await screen.findByRole("button", { name: /^Pasadena/ }))

    expect(screen.getByRole("heading", { level: 2, name: "Pasadena" })).toBeInTheDocument()
    expect(screen.getByText("City · Jurisdiction · GEOID 0656000")).toBeInTheDocument()
    expect(screen.getByDisplayValue("reports@pasadena.gov")).toBeInTheDocument()
    expect(screen.getByDisplayValue("trash@pasadena.gov")).toBeInTheDocument()
    expect(screen.getByText("1 of 7 contacts set")).toBeInTheDocument()
    expect(screen.getByText("all routed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Save & route/ })).toBeEnabled()
    await waitFor(() =>
      expect(apiMock.getJurisdictionGeometry).toHaveBeenCalledWith({ geoid: "0656000" }),
    )
  })

  it("renders the unmapped bucket as a triage row and detail", async () => {
    apiMock.listJurisdictions.mockResolvedValue(
      page([
        jurisdiction({
          geoid: "__unmapped__",
          org: "Unmapped reports",
          reportsWaiting: 5,
          perCategoryCounts: { hazard: 5 },
        }),
      ]),
    )
    renderWithQuery(<DiscoveryPage focusId={null} />)

    const row = await screen.findByRole("button", { name: /^Unmapped reports/ })
    expect(row).toHaveTextContent("Needs mapping")
    expect(row).toHaveTextContent("5 waiting")
    expect(screen.getByText("Triage · location did not resolve")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "Unmapped reports" })).toBeInTheDocument()
    expect(screen.getByText("Waiting reports by type")).toBeInTheDocument()
    expect(screen.getByText("5 reports")).toBeInTheDocument()
    expect(apiMock.getJurisdictionGeometry).not.toHaveBeenCalled()
  })

  it("loads the next page with the cursor when Load more is clicked", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions
      .mockResolvedValueOnce(page([LA], { nextCursor: "cursor-2", total: 2 }))
      .mockResolvedValueOnce(page([PASADENA], { nextCursor: null }))
    renderWithQuery(<DiscoveryPage focusId={null} />)

    await userEvent.click(await screen.findByRole("button", { name: "Load more" }))

    expect(await screen.findByRole("button", { name: /^Pasadena/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Los Angeles/ })).toBeInTheDocument()
    expect(listCalls()).toEqual([
      { filter: "needs_mapping", sort: "oldest", limit: 50 },
      { filter: "needs_mapping", sort: "oldest", limit: 50, cursor: "cursor-2" },
    ])
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument()
  })

  it("maps the filter chips, type and sort controls onto the request params", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA]))
    renderWithQuery(<DiscoveryPage focusId={null} />)
    await screen.findByRole("button", { name: /^Los Angeles/ })

    await userEvent.click(chip(/^Routed/))
    await waitFor(() =>
      expect(listCalls()).toContainEqual({ filter: "routed", sort: "population", limit: 50 }),
    )
    const sort = screen.getByRole("combobox", { name: "Sort jurisdictions" })
    expect(sort).toBeEnabled()
    expect(sort).toHaveValue("pop")

    await userEvent.selectOptions(sort, "reports")
    await waitFor(() =>
      expect(listCalls()).toContainEqual({ filter: "routed", sort: "reports", limit: 50 }),
    )

    await userEvent.click(chip(/^All/))
    await waitFor(() =>
      expect(listCalls()).toContainEqual({ filter: "all", sort: "reports", limit: 50 }),
    )

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Filter by jurisdiction type" }),
      "county",
    )
    await waitFor(() =>
      expect(listCalls()).toContainEqual({ filter: "all", sort: "reports", layer: "county", limit: 50 }),
    )
    await waitFor(() =>
      expect(listCalls()).toContainEqual({
        filter: "needs_mapping",
        sort: "oldest",
        layer: "county",
        limit: 50,
      }),
    )

    await userEvent.click(chip(/^Needs mapping/))
    expect(screen.getByRole("combobox", { name: "Sort jurisdictions" })).toBeDisabled()
    expect(screen.getByRole("combobox", { name: "Sort jurisdictions" })).toHaveValue("oldest")
  })

  it("sends the trimmed search after the debounce", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA]))
    renderWithQuery(<DiscoveryPage focusId={null} />)
    await screen.findByRole("button", { name: /^Los Angeles/ })

    await userEvent.type(screen.getByPlaceholderText("Search place or GEOID…"), "  pasa ")

    await waitFor(() =>
      expect(listCalls()).toContainEqual({ filter: "needs_mapping", sort: "oldest", q: "pasa", limit: 50 }),
    )
  })

  it("deep-links a focusId into the search box and opens that jurisdiction", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA, PASADENA]))
    renderWithQuery(<DiscoveryPage focusId="0656000" />)

    expect(screen.getByPlaceholderText("Search place or GEOID…")).toHaveValue("0656000")
    expect(await screen.findByRole("heading", { level: 2, name: "Pasadena" })).toBeInTheDocument()
    await waitFor(() =>
      expect(listCalls()).toContainEqual({ filter: "needs_mapping", sort: "oldest", q: "0656000", limit: 50 }),
    )
    // The first request goes out before the debounce settles, so it carries no search term.
    expect(listCalls()[0]).toEqual({ filter: "needs_mapping", sort: "oldest", limit: 50 })
  })

  it("holds an empty detail pane when the focused jurisdiction is not in the loaded page (current behavior)", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA]))
    renderWithQuery(<DiscoveryPage focusId="9999999" />)

    expect(await screen.findByRole("button", { name: /^Los Angeles/ })).toBeInTheDocument()
    expect(screen.getByText("No jurisdiction selected")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument()
  })
})

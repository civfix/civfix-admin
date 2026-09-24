import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, onTestFinished, vi } from "vitest"
import type {
  GetForwardTemplateDefaultResponse,
  JurisdictionDirectoryDTO,
  JurisdictionDirectoryResponse,
  JurisdictionGeometryResponse,
} from "@civfix/shared"

import type * as ApiModule from "@/lib/api"
import { categoryLabel } from "@/lib/category"
import { EMPTY_VALUE } from "@/lib/empty-value"
import { makeQueryClient } from "@/lib/query"
import { useUiStore, type ToastTone } from "@/store/ui-store"
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

function spyToasts() {
  const original = useUiStore.getState().showToast
  const showToast = vi.fn<(text: string, tone?: ToastTone) => void>()
  useUiStore.setState({ showToast })
  onTestFinished(() => useUiStore.setState({ showToast: original }))
  return showToast
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
    expect(chip(/^Needs mapping/)).toHaveTextContent(new RegExp(`^Needs mapping\\s*${EMPTY_VALUE}$`))

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

  it("deep-links a focusId on the All filter with the search already applied, so a routed jurisdiction opens", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockImplementation(async (params: { filter?: string; q?: string }) =>
      params.filter === "all" && params.q === "0656000" ? page([PASADENA]) : page([LA]),
    )
    renderWithQuery(<DiscoveryPage focusId="0656000" />)

    expect(screen.getByPlaceholderText("Search place or GEOID…")).toHaveValue("0656000")
    expect(await screen.findByRole("heading", { level: 2, name: "Pasadena" })).toBeInTheDocument()
    expect(listCalls()[0]).toEqual({ filter: "all", sort: "population", q: "0656000", limit: 50 })
    expect(listCalls().every((call) => call.q === "0656000")).toBe(true)
  })

  it("switches to the All filter when a new focusId arrives", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockImplementation(async (params: { filter?: string; q?: string }) =>
      params.filter === "all" && params.q === "0656000" ? page([PASADENA]) : page([LA]),
    )
    const { rerender, client } = renderWithQuery(<DiscoveryPage focusId={null} />)
    await screen.findByRole("heading", { level: 2, name: "Los Angeles" })

    rerender(
      <QueryClientProvider client={client}>
        <DiscoveryPage focusId="0656000" />
      </QueryClientProvider>,
    )

    expect(await screen.findByRole("heading", { level: 2, name: "Pasadena" })).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Search place or GEOID…")).toHaveValue("0656000")
  })

  it("keeps a focused jurisdiction selected when the list does not have it, and says so", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA]))
    renderWithQuery(<DiscoveryPage focusId="9999999" />)

    const laRow = await screen.findByRole("button", { name: /^Los Angeles/ })
    expect(screen.getByText("Not in this list")).toBeInTheDocument()
    expect(screen.getByText("No loaded jurisdiction has GEOID 9999999.")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument()
    expect(laRow).not.toHaveAttribute("aria-current")
  })

  it("clears a jurisdiction that saving drops from the Needs mapping list, without opening another", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA, PASADENA]))
    apiMock.saveJurisdictionContacts.mockImplementation(async () => {
      apiMock.listJurisdictions.mockResolvedValue(page([PASADENA]))
      return { ok: true }
    })
    renderWithQuery(<DiscoveryPage focusId={null} />)
    await screen.findByRole("heading", { level: 2, name: "Los Angeles" })

    await userEvent.type(screen.getByRole("textbox", { name: "Default contact email" }), "reports@la.gov")
    await userEvent.click(screen.getByRole("button", { name: /Save & route/ }))

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Los Angeles/ })).not.toBeInTheDocument(),
    )
    expect(await screen.findByText("No jurisdiction selected")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Pasadena/ })).not.toHaveAttribute("aria-current")
  })

  it("confirms Save & route even when the list drops the jurisdiction before the needs-mapping count refetch lands", async () => {
    useUiStore.setState({ toast: null })
    mockDetailQueries()
    let releaseCount: () => void = () => {}
    apiMock.listJurisdictions.mockResolvedValue(page([LA, PASADENA]))
    apiMock.saveJurisdictionContacts.mockImplementation(async () => {
      apiMock.listJurisdictions.mockImplementation((params: { filter?: string }) =>
        params.filter === "needs_mapping"
          ? new Promise((resolve) => {
              releaseCount = () => resolve(page([PASADENA]))
            })
          : Promise.resolve(page([PASADENA])),
      )
      return { ok: true }
    })
    renderWithQuery(<DiscoveryPage focusId={null} />)
    await userEvent.click(chip(/^All/))
    await waitFor(() => expect(listCalls().at(-1)).toMatchObject({ filter: "all" }))
    await screen.findByRole("heading", { level: 2, name: "Los Angeles" })

    await userEvent.type(screen.getByRole("textbox", { name: "Default contact email" }), "reports@la.gov")
    await userEvent.click(screen.getByRole("button", { name: /Save & route/ }))

    expect(await screen.findByText("No jurisdiction selected")).toBeInTheDocument()
    await act(async () => {
      releaseCount()
    })
    await waitFor(() =>
      expect(useUiStore.getState().toast).toMatchObject({
        text: "Contacts saved for Los Angeles · discovery task closed",
        tone: "ok",
      }),
    )
  })

  it("marks the selected row current", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA, PASADENA]))
    renderWithQuery(<DiscoveryPage focusId={null} />)

    const laRow = await screen.findByRole("button", { name: /^Los Angeles/ })
    expect(laRow).toHaveAttribute("aria-current", "true")
    expect(screen.getByRole("button", { name: /^Pasadena/ })).not.toHaveAttribute("aria-current")
  })

  it("shows loading, not zero, on the Routed and All chips while the directory loads", async () => {
    apiMock.listJurisdictions.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<DiscoveryPage focusId={null} />)

    await screen.findByRole("status")
    expect(chip(/^Routed/)).toHaveTextContent("Loading…")
    expect(chip(/^All/)).toHaveTextContent("Loading…")
  })

  it("keeps the operator's sort through a visit to Needs mapping", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA]))
    renderWithQuery(<DiscoveryPage focusId={null} />)
    await screen.findByRole("button", { name: /^Los Angeles/ })

    await userEvent.click(chip(/^Routed/))
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sort jurisdictions" }), "reports")
    await userEvent.click(chip(/^Needs mapping/))
    await userEvent.click(chip(/^Routed/))

    expect(screen.getByRole("combobox", { name: "Sort jurisdictions" })).toHaveValue("reports")
  })

  it("names every search and contact field", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA]))
    renderWithQuery(<DiscoveryPage focusId={null} />)
    await screen.findByRole("heading", { level: 2, name: "Los Angeles" })

    for (const name of [
      "Search jurisdictions",
      "Note for the next operator",
      "Default contact email",
      "Report form URL",
      `${categoryLabel("trash")} contact email`,
    ]) {
      expect(screen.getByRole("textbox", { name })).toBeInTheDocument()
    }
  })
})

describe("DiscoveryPage saving", () => {
  it("sends null for a contact the operator emptied, so the old address stops receiving reports", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([PASADENA]))
    apiMock.patchJurisdiction.mockResolvedValue({ ok: true })
    renderWithQuery(<DiscoveryPage focusId={null} />)
    await screen.findByRole("heading", { level: 2, name: "Pasadena" })

    await userEvent.clear(screen.getByDisplayValue("trash@pasadena.gov"))
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }))

    await waitFor(() => expect(apiMock.patchJurisdiction).toHaveBeenCalled())
    expect(apiMock.patchJurisdiction).toHaveBeenCalledWith({
      geoid: "0656000",
      contacts: { trash: null },
      defaultEmails: ["reports@pasadena.gov"],
    })
    expect(
      screen.getByText(/Clearing the default email or form URL here does not remove the saved one\./),
    ).toBeInTheDocument()
  })

  it("sends null for a contact saved earlier in this visit and then emptied", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA]))
    apiMock.patchJurisdiction.mockResolvedValue({ ok: true })
    renderWithQuery(<DiscoveryPage focusId={null} />)
    await screen.findByRole("heading", { level: 2, name: "Los Angeles" })
    const trash = screen.getByRole("textbox", { name: `${categoryLabel("trash")} contact email` })

    await userEvent.type(trash, "wrong@la.gov")
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }))
    await waitFor(() =>
      expect(apiMock.patchJurisdiction).toHaveBeenLastCalledWith({
        geoid: "0644000",
        contacts: { trash: "wrong@la.gov" },
      }),
    )
    await waitFor(() => expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled())

    await userEvent.clear(trash)
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }))

    await waitFor(() => expect(apiMock.patchJurisdiction).toHaveBeenCalledTimes(2))
    expect(apiMock.patchJurisdiction).toHaveBeenLastCalledWith({
      geoid: "0644000",
      contacts: { trash: null },
    })
  })

  it("routes with every contact the form shows, including ones saved before this visit", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(
      page([jurisdiction({ contacts: [{ category: "trash", email: "trash@la.gov" }] })]),
    )
    apiMock.saveJurisdictionContacts.mockResolvedValue({ ok: true })
    renderWithQuery(<DiscoveryPage focusId={null} />)
    await screen.findByRole("heading", { level: 2, name: "Los Angeles" })

    await userEvent.click(screen.getByRole("button", { name: /Save & route/ }))

    await waitFor(() =>
      expect(apiMock.saveJurisdictionContacts).toHaveBeenCalledWith({
        geoid: "0644000",
        contacts: { trash: "trash@la.gov" },
      }),
    )
  })

  it("routes with the shown contacts plus null for one the operator emptied", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(
      page([
        jurisdiction({
          contacts: [
            { category: "trash", email: "trash@la.gov" },
            { category: "graffiti", email: "old@la.gov" },
          ],
        }),
      ]),
    )
    apiMock.saveJurisdictionContacts.mockResolvedValue({ ok: true })
    renderWithQuery(<DiscoveryPage focusId={null} />)
    await screen.findByRole("heading", { level: 2, name: "Los Angeles" })

    await userEvent.clear(screen.getByDisplayValue("old@la.gov"))
    await userEvent.click(screen.getByRole("button", { name: /Save & route/ }))

    await waitFor(() =>
      expect(apiMock.saveJurisdictionContacts).toHaveBeenCalledWith({
        geoid: "0644000",
        contacts: { trash: "trash@la.gov", graffiti: null },
      }),
    )
  })

  it("normalizes the @handle the way the server does before comparing it", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([jurisdiction({ handle: "la" })]))
    renderWithQuery(<DiscoveryPage focusId={null} />)
    await screen.findByRole("heading", { level: 2, name: "Los Angeles" })

    const handle = screen.getByRole("textbox", { name: "Jurisdiction discussion handle" })
    await userEvent.clear(handle)
    await userEvent.type(handle, "@ LA")
    expect(screen.getByText(/Residents can tag \u201c@la\u201d/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Save draft" }))
    expect(apiMock.patchJurisdiction).not.toHaveBeenCalled()
  })

  it("shows an invalid @handle inline and holds both saves", async () => {
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([PASADENA]))
    renderWithQuery(<DiscoveryPage focusId={null} />)
    await screen.findByRole("heading", { level: 2, name: "Pasadena" })

    await userEvent.type(screen.getByRole("textbox", { name: "Jurisdiction discussion handle" }), "a")

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Handle must be 2-40 characters using lowercase letters, numbers, or underscores.",
    )
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Save & route/ })).toBeDisabled()
  })

  it("shows one error toast when Save draft fails", async () => {
    const toasts = spyToasts()
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA]))
    apiMock.patchJurisdiction.mockRejectedValue(new Error("Jurisdiction service down"))
    renderWithQuery(<DiscoveryPage focusId={null} />, makeQueryClient())
    await screen.findByRole("heading", { level: 2, name: "Los Angeles" })

    await userEvent.type(screen.getByRole("textbox", { name: "Default contact email" }), "reports@la.gov")
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }))

    await waitFor(() => expect(toasts).toHaveBeenCalled())
    expect(toasts).toHaveBeenCalledTimes(1)
    expect(toasts).toHaveBeenCalledWith("Jurisdiction service down", "error")
  })

  it("shows one error toast when saving the email template fails", async () => {
    const toasts = spyToasts()
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA]))
    apiMock.patchJurisdiction.mockRejectedValue(new Error("Jurisdiction service down"))
    renderWithQuery(<DiscoveryPage focusId={null} />, makeQueryClient())
    await screen.findByRole("heading", { level: 2, name: "Los Angeles" })
    const edit = screen.getByRole("button", { name: "Edit template" })
    await waitFor(() => expect(edit).toBeEnabled())

    await userEvent.click(edit)
    const dialog = screen.getByRole("dialog", { name: "Forwarding email for Los Angeles" })
    await userEvent.type(within(dialog).getByLabelText("Subject"), "Report forwarded")
    await userEvent.click(within(dialog).getByRole("button", { name: /Save/ }))

    await waitFor(() => expect(toasts).toHaveBeenCalled())
    expect(toasts).toHaveBeenCalledTimes(1)
  })

  it("says what was saved when Save & route saves the note but not the contacts", async () => {
    const toasts = spyToasts()
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA]))
    apiMock.patchJurisdiction.mockResolvedValue({ ok: true })
    apiMock.saveJurisdictionContacts.mockRejectedValue(new Error("Contacts service down"))
    renderWithQuery(<DiscoveryPage focusId={null} />, makeQueryClient())
    await screen.findByRole("heading", { level: 2, name: "Los Angeles" })

    await userEvent.type(
      screen.getByRole("textbox", { name: "Note for the next operator" }),
      "Called the clerk",
    )
    await userEvent.type(screen.getByRole("textbox", { name: "Default contact email" }), "reports@la.gov")
    await userEvent.click(screen.getByRole("button", { name: /Save & route/ }))

    await waitFor(() => expect(toasts).toHaveBeenCalled())
    expect(apiMock.patchJurisdiction).toHaveBeenCalledWith({ geoid: "0644000", notes: "Called the clerk" })
    expect(toasts).toHaveBeenCalledTimes(1)
    expect(toasts).toHaveBeenCalledWith(
      "The note was saved, but the contacts were not: Contacts service down",
      "error",
    )
  })

  it("still says what was saved when Save & route fails after the operator moved to another jurisdiction", async () => {
    const toasts = spyToasts()
    mockDetailQueries()
    apiMock.listJurisdictions.mockResolvedValue(page([LA, PASADENA]))
    apiMock.patchJurisdiction.mockResolvedValue({ ok: true })
    let rejectSave: (error: Error) => void = () => {}
    apiMock.saveJurisdictionContacts.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectSave = reject
      }),
    )
    renderWithQuery(<DiscoveryPage focusId={null} />, makeQueryClient())
    await screen.findByRole("heading", { level: 2, name: "Los Angeles" })

    await userEvent.type(
      screen.getByRole("textbox", { name: "Note for the next operator" }),
      "Called the clerk",
    )
    await userEvent.type(screen.getByRole("textbox", { name: "Default contact email" }), "reports@la.gov")
    await userEvent.click(screen.getByRole("button", { name: /Save & route/ }))
    await waitFor(() => expect(apiMock.saveJurisdictionContacts).toHaveBeenCalled())

    await userEvent.click(screen.getByRole("button", { name: /^Pasadena/ }))
    await screen.findByRole("heading", { level: 2, name: "Pasadena" })
    rejectSave(new Error("Contacts service down"))

    await waitFor(() => expect(toasts).toHaveBeenCalled())
    expect(toasts).toHaveBeenCalledTimes(1)
    expect(toasts).toHaveBeenCalledWith(
      "The note was saved, but the contacts were not: Contacts service down",
      "error",
    )
  })
})

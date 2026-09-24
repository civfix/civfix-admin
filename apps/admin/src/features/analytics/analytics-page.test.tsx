import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type {
  AnalyticsByCategoryResponse,
  AnalyticsCoverageResponse,
  AnalyticsEventsResponse,
  AnalyticsFunnelResponse,
  AnalyticsKpisResponse,
  AnalyticsPinsByWeekResponse,
  AnalyticsResolutionByCategoryResponse,
  AnalyticsTopContributorsResponse,
  AnalyticsTopJurisdictionsResponse,
} from "@civfix/shared"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Toast } from "@/components/shell/toast"
import type * as ApiModule from "@/lib/api"
import { AnalyticsPage } from "@/features/analytics/analytics-page"
import { useUiStore } from "@/store/ui-store"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

afterEach(() => {
  useUiStore.setState({ toast: null })
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const ANALYTICS_METHODS = [
  "analyticsKpis",
  "analyticsPinsByWeek",
  "analyticsByCategory",
  "analyticsFunnel",
  "analyticsCoverage",
  "analyticsResolutionByCategory",
  "analyticsEvents",
  "analyticsTopJurisdictions",
  "analyticsTopContributors",
] as const

const CARD_TITLES = [
  "Pins per week",
  "By category",
  "Report funnel",
  "Mapping coverage",
  "Median resolution time",
  "Cleanup events",
  "Top jurisdictions",
  "Top contributors",
] as const

const kpis = {
  kpis: [
    { label: "Pins dropped", num: 1234, delta: "+12% vs last month", dir: "up" },
    { label: "Reports routed", num: 900, delta: "+3%", dir: "up" },
    { label: "Resolved", num: 41.6, delta: "-2 pts", dir: "down" },
    { label: "Cleanups planned", num: 7, delta: "no change", dir: "flat" },
  ],
} satisfies AnalyticsKpisResponse

const pinsByWeek = {
  weeks: [3, 1200],
  labels: ["Wk A", "Wk B"],
} satisfies AnalyticsPinsByWeekResponse

const byCategory = {
  rows: [
    { cat: "trash", count: 12, pct: 70 },
    { cat: "graffiti", count: 5, pct: 30 },
  ],
} satisfies AnalyticsByCategoryResponse

const funnel = {
  stages: [
    { stage: "Pin dropped", count: 1500, pct: 100 },
    { stage: "Resolved", count: 300, pct: 20 },
  ],
} satisfies AnalyticsFunnelResponse

const coverage = { pct: 75, mapped: 30, needsMapping: 10 } satisfies AnalyticsCoverageResponse

const resolution = {
  rows: [
    { cat: "trash", hours: 5 },
    { cat: "graffiti", hours: 50 },
    { cat: "hazard", hours: 0.5 },
    { cat: "water", hours: 0 },
  ],
} satisfies AnalyticsResolutionByCategoryResponse

const events = {
  thisMonth: 4,
  volunteers: 1250,
  bags: 0,
  byMonth: [2, 6],
  monthLabels: ["Aug", "Sep"],
} satisfies AnalyticsEventsResponse

const topJurisdictions = {
  rows: [
    { org: "Oakland", pins: 120, resolved: 64 },
    { org: "Berkeley", pins: 45, resolved: 20 },
  ],
} satisfies AnalyticsTopJurisdictionsResponse

const topContributors = {
  rows: [
    { name: "Ada Lovelace", city: "Oakland", reports: 17, cleanups: 3 },
    { name: "grace", city: "", reports: 9, cleanups: 1 },
  ],
} satisfies AnalyticsTopContributorsResponse

function mockPopulated() {
  apiMock.analyticsKpis.mockResolvedValue(kpis)
  apiMock.analyticsPinsByWeek.mockResolvedValue(pinsByWeek)
  apiMock.analyticsByCategory.mockResolvedValue(byCategory)
  apiMock.analyticsFunnel.mockResolvedValue(funnel)
  apiMock.analyticsCoverage.mockResolvedValue(coverage)
  apiMock.analyticsResolutionByCategory.mockResolvedValue(resolution)
  apiMock.analyticsEvents.mockResolvedValue(events)
  apiMock.analyticsTopJurisdictions.mockResolvedValue(topJurisdictions)
  apiMock.analyticsTopContributors.mockResolvedValue(topContributors)
}

function card(title: string): HTMLElement {
  const section = screen.getByRole("heading", { level: 3, name: title }).closest("section")
  if (!section) throw new Error(`no card section for ${title}`)
  return section
}

async function findCard(title: string): Promise<HTMLElement> {
  await screen.findByRole("heading", { level: 3, name: title })
  return card(title)
}

// jsdom's Blob has no text(); FileReader is its supported read path.
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

function renderPage() {
  return renderWithQuery(
    <>
      <AnalyticsPage focusId={null} />
      <Toast />
    </>,
  )
}

describe("AnalyticsPage", () => {
  it("renders the page header with every card title and its meta line", async () => {
    mockPopulated()
    renderPage()

    expect(screen.getByRole("heading", { level: 1, name: "Analytics" })).toBeInTheDocument()
    expect(screen.getByText(/The numbers are the proof civfix works\./)).toBeInTheDocument()
    const metas: Record<(typeof CARD_TITLES)[number], string | RegExp> = {
      "Pins per week": "8-week trend",
      "By category": "this month",
      "Report funnel": /^pin .* resolved$/,
      "Mapping coverage": "jurisdictions",
      "Median resolution time": "by report type",
      "Cleanup events": "8-month trend",
      "Top jurisdictions": "by pin volume",
      "Top contributors": "reports + cleanups",
    }
    for (const title of CARD_TITLES) {
      expect(within(await findCard(title)).getByText(metas[title])).toBeInTheDocument()
    }
  })

  it("calls each analytics endpoint once with no arguments", async () => {
    mockPopulated()
    renderPage()

    await screen.findByText("Oakland", { selector: ".td-strong" })
    for (const method of ANALYTICS_METHODS) {
      expect(apiMock[method]).toHaveBeenCalledTimes(1)
      expect(apiMock[method]).toHaveBeenCalledWith()
    }
  })

  it("shows a loading state for the KPI strip and every card while requests are in flight", () => {
    for (const method of ANALYTICS_METHODS) {
      apiMock[method].mockReturnValue(new Promise(() => {}))
    }
    renderPage()

    expect(screen.getByText("Loading KPIs...")).toBeInTheDocument()
    for (const title of CARD_TITLES) {
      expect(within(card(title)).getByText(`Loading ${title.toLowerCase()}...`)).toBeInTheDocument()
    }
    expect(screen.getAllByRole("status")).toHaveLength(CARD_TITLES.length + 1)
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled()
  })

  it("shows an error with the server message and a retry in the KPI strip and every card", async () => {
    for (const method of ANALYTICS_METHODS) {
      apiMock[method].mockRejectedValue(new Error(`${method} is down`))
    }
    renderPage()

    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(CARD_TITLES.length + 1))
    expect(screen.getByText("analyticsKpis is down")).toBeInTheDocument()
    const cardMethods: Record<(typeof CARD_TITLES)[number], string> = {
      "Pins per week": "analyticsPinsByWeek",
      "By category": "analyticsByCategory",
      "Report funnel": "analyticsFunnel",
      "Mapping coverage": "analyticsCoverage",
      "Median resolution time": "analyticsResolutionByCategory",
      "Cleanup events": "analyticsEvents",
      "Top jurisdictions": "analyticsTopJurisdictions",
      "Top contributors": "analyticsTopContributors",
    }
    for (const title of CARD_TITLES) {
      const alert = within(card(title)).getByRole("alert")
      expect(within(alert).getByText("Could not load this")).toBeInTheDocument()
      expect(within(alert).getByText(`${cardMethods[title]} is down`)).toBeInTheDocument()
      expect(within(alert).getByRole("button", { name: "Try again" })).toBeInTheDocument()
    }
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled()
  })

  it("isolates a failing card: the other cards still render their data", async () => {
    mockPopulated()
    apiMock.analyticsFunnel.mockRejectedValue(new Error("funnel exploded"))
    renderPage()

    expect(await within(card("Report funnel")).findByText("funnel exploded")).toBeInTheDocument()
    expect(within(card("Mapping coverage")).getByText("30 mapped")).toBeInTheDocument()
    expect(screen.getAllByRole("alert")).toHaveLength(1)
  })

  it("retries only the failed card when Try again is pressed", async () => {
    mockPopulated()
    apiMock.analyticsCoverage.mockRejectedValueOnce(new Error("coverage offline"))
    renderPage()

    const coverageCard = await findCard("Mapping coverage")
    await within(coverageCard).findByText("coverage offline")
    await userEvent.click(within(coverageCard).getByRole("button", { name: "Try again" }))

    expect(await within(coverageCard).findByText("30 mapped")).toBeInTheDocument()
    expect(apiMock.analyticsCoverage).toHaveBeenCalledTimes(2)
    expect(apiMock.analyticsFunnel).toHaveBeenCalledTimes(1)
  })

  it("retries the KPI strip from its error state", async () => {
    mockPopulated()
    apiMock.analyticsKpis.mockRejectedValueOnce(new Error("kpis offline"))
    renderPage()

    const alert = (await screen.findByText("kpis offline")).closest("[role=alert]") as HTMLElement
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }))

    expect(await screen.findByText("1,234")).toBeInTheDocument()
    expect(screen.queryByText("kpis offline")).not.toBeInTheDocument()
    expect(apiMock.analyticsKpis).toHaveBeenCalledTimes(2)
  })

  it("shows the 'No data yet' empty state on every card when the aggregates are empty", async () => {
    apiMock.analyticsKpis.mockResolvedValue({ kpis: [] } satisfies AnalyticsKpisResponse)
    apiMock.analyticsPinsByWeek.mockResolvedValue({ weeks: [], labels: [] } satisfies AnalyticsPinsByWeekResponse)
    apiMock.analyticsByCategory.mockResolvedValue({
      rows: [{ cat: "trash", count: 0, pct: 0 }],
    } satisfies AnalyticsByCategoryResponse)
    apiMock.analyticsFunnel.mockResolvedValue({ stages: [] } satisfies AnalyticsFunnelResponse)
    apiMock.analyticsCoverage.mockResolvedValue({
      pct: 0,
      mapped: 0,
      needsMapping: 0,
    } satisfies AnalyticsCoverageResponse)
    apiMock.analyticsResolutionByCategory.mockResolvedValue({
      rows: [{ cat: "trash", hours: 0 }],
    } satisfies AnalyticsResolutionByCategoryResponse)
    apiMock.analyticsEvents.mockResolvedValue({
      thisMonth: 3,
      volunteers: 10,
      bags: 2,
      byMonth: [],
      monthLabels: [],
    } satisfies AnalyticsEventsResponse)
    apiMock.analyticsTopJurisdictions.mockResolvedValue({ rows: [] } satisfies AnalyticsTopJurisdictionsResponse)
    apiMock.analyticsTopContributors.mockResolvedValue({ rows: [] } satisfies AnalyticsTopContributorsResponse)
    renderPage()

    await waitFor(() => expect(screen.getAllByText("No data yet")).toHaveLength(CARD_TITLES.length))
    for (const title of CARD_TITLES) {
      const c = card(title)
      expect(within(c).getByText("No data yet")).toBeInTheDocument()
      expect(within(c).getByText("Nothing to show for this window.")).toBeInTheDocument()
    }
    expect(screen.queryByText("events this month")).not.toBeInTheDocument()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    // An empty KPI list still counts as loaded, so Export is enabled with an empty strip.
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled()
  })

  it("renders the KPI strip: hides routing KPIs, shows resolved as a rounded percent, counts with separators", async () => {
    mockPopulated()
    renderPage()

    expect(await screen.findByText("Pins dropped")).toBeInTheDocument()
    expect(screen.getByText("1,234")).toBeInTheDocument()
    expect(screen.getByText("+12% vs last month")).toBeInTheDocument()
    expect(screen.getByText("Resolved", { selector: ".statcell-label" })).toBeInTheDocument()
    expect(screen.getByText("42%")).toBeInTheDocument()
    expect(screen.getByText("-2 pts")).toBeInTheDocument()
    expect(screen.getByText("Cleanups planned")).toBeInTheDocument()
    expect(screen.getByText("7")).toBeInTheDocument()
    expect(screen.getByText("no change")).toBeInTheDocument()
    expect(screen.queryByText("Reports routed")).not.toBeInTheDocument()
    expect(screen.queryByText("900")).not.toBeInTheDocument()
  })

  it("renders the pins-per-week bars with compact values and week labels", async () => {
    mockPopulated()
    renderPage()

    const c = await findCard("Pins per week")
    expect(await within(c).findByText("1.2k")).toBeInTheDocument()
    expect(within(c).getByText("3")).toBeInTheDocument()
    expect(within(c).getByText("Wk A")).toBeInTheDocument()
    expect(within(c).getByText("Wk B")).toBeInTheDocument()
  })

  it("renders the by-category breakdown with labels and counts", async () => {
    mockPopulated()
    renderPage()

    const c = await findCard("By category")
    expect(await within(c).findByText("Trash")).toBeInTheDocument()
    expect(within(c).getByText("12")).toBeInTheDocument()
    expect(within(c).getByText("Graffiti")).toBeInTheDocument()
    expect(within(c).getByText("5")).toBeInTheDocument()
  })

  it("renders the report funnel stages with formatted counts", async () => {
    mockPopulated()
    renderPage()

    const c = await findCard("Report funnel")
    expect(await within(c).findByText("Pin dropped")).toBeInTheDocument()
    expect(within(c).getByText("1,500")).toBeInTheDocument()
    expect(within(c).getByText("Resolved")).toBeInTheDocument()
    expect(within(c).getByText("300")).toBeInTheDocument()
  })

  it("renders mapping coverage as a percent with the mapped and needs-mapping legend", async () => {
    mockPopulated()
    renderPage()

    const c = await findCard("Mapping coverage")
    expect(await within(c).findByText("30 mapped")).toBeInTheDocument()
    expect(within(c).getByText("10 need mapping")).toBeInTheDocument()
    expect(within(c).getByText("75", { exact: false })).toHaveTextContent("75%")
    expect(within(c).getByText("routed & live")).toBeInTheDocument()
  })

  it("renders median resolution time humanized per category", async () => {
    mockPopulated()
    renderPage()

    const c = await findCard("Median resolution time")
    expect(await within(c).findByText("Trash")).toBeInTheDocument()
    expect(within(c).getByText("5h")).toBeInTheDocument()
    expect(within(c).getByText("Graffiti")).toBeInTheDocument()
    expect(within(c).getByText("2d 2h")).toBeInTheDocument()
    expect(within(c).getByText("Hazard")).toBeInTheDocument()
    expect(within(c).getByText("<1h")).toBeInTheDocument()
    expect(within(c).getByText("Water")).toBeInTheDocument()
    expect(within(c).getByText(/^\u2014$/)).toBeInTheDocument()
  })

  it("renders cleanup events stats and hides bags collected when there are none", async () => {
    mockPopulated()
    renderPage()

    const c = await findCard("Cleanup events")
    expect(await within(c).findByText("events this month")).toBeInTheDocument()
    expect(within(c).getByText("4")).toBeInTheDocument()
    expect(within(c).getByText("volunteers")).toBeInTheDocument()
    expect(within(c).getByText("1,250")).toBeInTheDocument()
    expect(within(c).queryByText("bags collected")).not.toBeInTheDocument()
    expect(within(c).getByText("Aug")).toBeInTheDocument()
    expect(within(c).getByText("Sep")).toBeInTheDocument()
  })

  it("shows bags collected when the events aggregate has bags", async () => {
    mockPopulated()
    apiMock.analyticsEvents.mockResolvedValue({ ...events, bags: 2500 } satisfies AnalyticsEventsResponse)
    renderPage()

    const c = await findCard("Cleanup events")
    expect(await within(c).findByText("bags collected")).toBeInTheDocument()
    expect(within(c).getByText("2,500")).toBeInTheDocument()
  })

  it("renders the top jurisdictions table", async () => {
    mockPopulated()
    renderPage()

    const c = await findCard("Top jurisdictions")
    expect(await within(c).findByText("Oakland")).toBeInTheDocument()
    for (const header of ["Jurisdiction", "Pins", "Resolved"]) {
      expect(within(c).getByText(header)).toBeInTheDocument()
    }
    expect(within(c).getByText("120")).toBeInTheDocument()
    expect(within(c).getByText("64%")).toBeInTheDocument()
    expect(within(c).getByText("Berkeley")).toBeInTheDocument()
    expect(within(c).getByText("45")).toBeInTheDocument()
    expect(within(c).getByText("20%")).toBeInTheDocument()
  })

  it("renders the top contributors table with initials and a placeholder for a missing city", async () => {
    mockPopulated()
    renderPage()

    const c = await findCard("Top contributors")
    expect(await within(c).findByText("Ada Lovelace")).toBeInTheDocument()
    for (const header of ["Neighbor", "Reports", "Cleanups"]) {
      expect(within(c).getByText(header)).toBeInTheDocument()
    }
    expect(within(c).getByText("AL")).toBeInTheDocument()
    expect(within(c).getByText("Oakland")).toBeInTheDocument()
    expect(within(c).getByText("17")).toBeInTheDocument()
    expect(within(c).getByText("grace")).toBeInTheDocument()
    expect(within(c).getByText("G")).toBeInTheDocument()
    expect(within(c).getByText(/^\u2014$/)).toBeInTheDocument()
    expect(within(c).getByText("9")).toBeInTheDocument()
  })

  it("exports the KPIs, event totals and category shares as a CSV download and confirms with a toast", async () => {
    mockPopulated()
    const blobs: Blob[] = []
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob)
      return "blob:analytics"
    })
    const revokeObjectURL = vi.fn()
    // jsdom implements neither static, so there is nothing on the real URL for vi.spyOn to wrap.
    vi.stubGlobal(
      "URL",
      class extends URL {
        static override createObjectURL = createObjectURL
        static override revokeObjectURL = revokeObjectURL
      },
    )
    const downloads: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download)
    })
    renderPage()

    const exportButton = screen.getByRole("button", { name: "Export" })
    expect(exportButton).toBeDisabled()
    await within(await findCard("Cleanup events")).findByText("events this month")
    await within(card("By category")).findByText("Trash")
    await waitFor(() => expect(exportButton).toBeEnabled())
    await userEvent.click(exportButton)

    expect(downloads).toEqual(["civfix-analytics.csv"])
    expect(blobs).toHaveLength(1)
    const blob = blobs[0] as Blob
    expect(blob.type).toBe("text/csv")
    expect(await readBlob(blob)).toBe(
      [
        '"Metric","Value","Change"',
        '"Pins dropped","1234","\'+12% vs last month"',
        '"Resolved","41.6","\'-2 pts"',
        '"Cleanups planned","7","no change"',
        '"Cleanup events (month)","4",""',
        '"Volunteers","1250",""',
        "",
        '"Category","Reports","Share %"',
        '"Trash","12","70"',
        '"Graffiti","5","30"',
      ].join("\n"),
    )
    expect(await screen.findByText("Analytics exported · civfix-analytics.csv")).toBeInTheDocument()
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:analytics"))
  })
})

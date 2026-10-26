import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { GetLegalVersionsResponse, LegalDocumentType, LegalDocumentVersionDTO } from "@civfix/contract"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { LegalPage } from "@/features/legal/legal-page"
import { apiMock } from "@/test/api-mock"
import { renderWithQuery } from "@/test/render"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const GENERATED_AT = "2026-10-27T12:00:00.000Z"
const CURRENT = "2026-10-27"

function legalVersion(
  type: LegalDocumentType,
  version: string,
  extra: Partial<LegalDocumentVersionDTO> = {},
): LegalDocumentVersionDTO {
  return {
    type,
    version,
    sha256: "0".repeat(64),
    effectiveAt: `${version.slice(0, 10)}T00:00:00.000Z`,
    url: `https://civfix.test/legal/${type}/${version}`,
    ...extra,
  } satisfies LegalDocumentVersionDTO
}

const NO_CHANGE = { summary: "No change in wording", material: false } satisfies Partial<LegalDocumentVersionDTO>

const OLDER: Record<LegalDocumentType, string[]> = {
  terms: ["2026-09-21", "2026-09-16", "2026-09-06"],
  privacy: ["2026-09-21", "2026-09-16", "2026-09-06"],
  cookies: ["2026-09-16", "2026-09-06"],
  subprocessors: ["2026-09-16", "2026-09-06"],
}

const CURRENT_EXTRA: Record<LegalDocumentType, Partial<LegalDocumentVersionDTO>> = {
  terms: { ...NO_CHANGE, acceptedCount: 812, activeAccounts: 1204 },
  privacy: { ...NO_CHANGE, acceptedCount: 790, activeAccounts: 1204 },
  cookies: NO_CHANGE,
  subprocessors: NO_CHANGE,
}

/** Fixture F, newest first per document; `termsCurrent` replaces fields of the current Terms version. */
function fixtureF(termsCurrent: Partial<LegalDocumentVersionDTO> = {}): GetLegalVersionsResponse {
  const types: LegalDocumentType[] = ["terms", "privacy", "cookies", "subprocessors"]
  const documents = types.flatMap((type) => [
    legalVersion(type, CURRENT, { ...CURRENT_EXTRA[type], ...(type === "terms" ? termsCurrent : {}) }),
    ...OLDER[type].map((version) => legalVersion(type, version)),
  ])
  return { documents, generatedAt: GENERATED_AT } satisfies GetLegalVersionsResponse
}

const VERSION_TEXT = /^\d{4}-\d{2}-\d{2}(-\d+)?$/

function card(label: string): HTMLElement {
  return screen.getByRole("heading", { name: label, level: 3 }).closest("section") as HTMLElement
}

function versionsIn(label: string): string[] {
  return within(card(label))
    .getAllByText(VERSION_TEXT)
    .map((el) => el.textContent ?? "")
}

function row(label: string, version: string): HTMLElement {
  return within(card(label)).getByText(version).closest(".qrow") as HTMLElement
}

async function renderLoaded(response: GetLegalVersionsResponse) {
  apiMock.adminGetLegalVersions.mockResolvedValue(response)
  const view = renderWithQuery(<LegalPage focusId={null} />)
  await screen.findByRole("heading", { name: "Terms of Service", level: 3 })
  return view
}

describe("LegalPage", () => {
  it("T4: lists the four documents in order, each newest first", async () => {
    await renderLoaded(fixtureF())

    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Terms of Service",
      "Privacy Policy",
      "Cookie Policy",
      "Subprocessors",
    ])
    expect(versionsIn("Terms of Service")).toEqual(["2026-10-27", "2026-09-21", "2026-09-16", "2026-09-06"])
    expect(within(card("Cookie Policy")).getByText("3 versions")).toBeInTheDocument()
  })

  it("T5: sorts the versions itself when the server sends them oldest first", async () => {
    const response = fixtureF()
    await renderLoaded({ ...response, documents: [...response.documents].reverse() })

    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Terms of Service",
      "Privacy Policy",
      "Cookie Policy",
      "Subprocessors",
    ])
    expect(versionsIn("Terms of Service")).toEqual(["2026-10-27", "2026-09-21", "2026-09-16", "2026-09-06"])
    expect(within(card("Cookie Policy")).getByText("3 versions")).toBeInTheDocument()
  })

  it("T6: a notice-only version shows Notice only and its summary", async () => {
    await renderLoaded(fixtureF())

    const current = row("Terms of Service", CURRENT)
    expect(within(current).getByText("Notice only")).toBeInTheDocument()
    expect(within(current).getByText("No change in wording")).toBeInTheDocument()
    expect(within(current).queryByText("Material")).not.toBeInTheDocument()
  })

  it("T7: a material version shows Material and its summary", async () => {
    await renderLoaded(fixtureF({ material: true, summary: "New arbitration clause" }))

    const current = row("Terms of Service", CURRENT)
    expect(within(current).getByText("Material")).toBeInTheDocument()
    expect(within(current).getByText("New arbitration clause")).toBeInTheDocument()
    expect(within(current).queryByText("Notice only")).not.toBeInTheDocument()
  })

  it("T8: versions from before change notes say so and carry no flag", async () => {
    await renderLoaded(fixtureF())

    const labels: Record<LegalDocumentType, string> = {
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      cookies: "Cookie Policy",
      subprocessors: "Subprocessors",
    }
    const older = Object.entries(OLDER).flatMap(([type, versions]) =>
      versions.map((version) => row(labels[type as LegalDocumentType], version)),
    )
    expect(older).toHaveLength(10)
    for (const el of older) {
      expect(within(el).getByText("Published before change notes were kept")).toBeInTheDocument()
      expect(within(el).queryByText("Material")).not.toBeInTheDocument()
      expect(within(el).queryByText("Notice only")).not.toBeInTheDocument()
    }
  })

  it("T9: the current Terms and Privacy versions show how many accounts accepted", async () => {
    await renderLoaded(fixtureF())

    expect(within(row("Terms of Service", CURRENT)).getByText("812 of 1,204 accounts accepted")).toBeInTheDocument()
    expect(within(row("Privacy Policy", CURRENT)).getByText("790 of 1,204 accounts accepted")).toBeInTheDocument()
    expect(screen.getAllByText(/accounts accepted/)).toHaveLength(2)
  })

  it("T10: no acceptance line when the active account count is missing", async () => {
    await renderLoaded(fixtureF({ acceptedCount: 812, activeAccounts: null }))

    expect(within(row("Terms of Service", CURRENT)).queryByText(/accounts accepted/)).not.toBeInTheDocument()
  })

  it("T11: a later version of the same day is listed first", async () => {
    const effectiveAt = "2026-10-27T00:00:00.000Z"
    await renderLoaded({
      documents: [
        legalVersion("terms", "2026-10-27", { ...NO_CHANGE, effectiveAt }),
        legalVersion("terms", "2026-10-27-2", { ...NO_CHANGE, effectiveAt }),
      ],
      generatedAt: GENERATED_AT,
    })

    expect(versionsIn("Terms of Service")).toEqual(["2026-10-27-2", "2026-10-27"])
  })

  it("T12: shows the loading state while the versions are in flight", async () => {
    apiMock.adminGetLegalVersions.mockReturnValue(new Promise(() => {}))
    renderWithQuery(<LegalPage focusId={null} />)

    expect(await screen.findByRole("status")).toHaveTextContent("Loading legal documents...")
  })

  it("T13: shows the error with a retry that refetches", async () => {
    apiMock.adminGetLegalVersions.mockRejectedValue(new Error("legal exploded"))
    renderWithQuery(<LegalPage focusId={null} />)

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("legal exploded")

    apiMock.adminGetLegalVersions.mockResolvedValue(fixtureF())
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("heading", { name: "Terms of Service", level: 3 })).toBeInTheDocument()
    expect(apiMock.adminGetLegalVersions).toHaveBeenCalledTimes(2)
  })

  it("T14: shows the empty state when no document is published", async () => {
    apiMock.adminGetLegalVersions.mockResolvedValue({ documents: [], generatedAt: GENERATED_AT })
    renderWithQuery(<LegalPage focusId={null} />)

    expect(await screen.findByText("No legal documents")).toBeInTheDocument()
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0)
  })

  it("T15: has no editing controls", async () => {
    const { container } = await renderLoaded(fixtureF())

    expect(container.querySelectorAll("button, input, textarea, select, [contenteditable]")).toHaveLength(0)
  })
})

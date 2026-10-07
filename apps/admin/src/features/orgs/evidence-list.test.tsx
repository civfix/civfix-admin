import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { AdminGetMediaResponse } from "@civfix/shared"
import { describe, expect, it, onTestFinished, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { apiMock } from "@/test/api-mock"
import { makeTestQueryClient, renderWithQuery } from "@/test/render"
import { queryKeys } from "@/lib/query"
import { EvidenceList } from "@/features/orgs/evidence-list"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const MEDIA_ID = "5f0c2d1e-0000-4000-8000-000000000001"

function evidence(expiresInMs: number): AdminGetMediaResponse {
  return {
    media: {
      id: MEDIA_ID,
      kind: "image",
      url: "https://media.test/evidence.jpg",
      status: "ready",
    },
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  }
}

describe("EvidenceList", () => {
  it("never renders an expired signed url, not even for the first frame", async () => {
    apiMock.adminGetMedia.mockReturnValue(new Promise(() => {}))
    const client = makeTestQueryClient()
    client.setQueryData(queryKeys.media.document(MEDIA_ID), evidence(-60_000))
    renderWithQuery(<EvidenceList mediaIds={[MEDIA_ID]} />, client)
    const createElement = vi.spyOn(document, "createElement")
    onTestFinished(() => createElement.mockRestore())

    await userEvent.click(screen.getByRole("button", { name: /Document 1/ }))

    expect(screen.getByRole("button", { name: /Request a new link/ })).toBeInTheDocument()
    expect(createElement.mock.calls.filter(([tag]) => tag === "img")).toEqual([])
  })

  it("names the document image and points the toggle at the opened viewer", async () => {
    apiMock.adminGetMedia.mockResolvedValue(evidence(120_000))
    renderWithQuery(<EvidenceList mediaIds={[MEDIA_ID]} />)
    const toggle = screen.getByRole("button", { name: /Document 1/ })
    expect(toggle).not.toHaveAttribute("aria-controls")

    await userEvent.click(toggle)

    const image = await screen.findByRole("img", { name: "Evidence document 1" })
    const viewerId = toggle.getAttribute("aria-controls")
    expect(viewerId).toBeTruthy()
    expect(document.getElementById(viewerId!)).toContainElement(image)
  })
})


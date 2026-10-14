import type { ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { apiMock } from "@/test/api-mock"
import { makeTestQueryClient } from "@/test/render"
import {
  useAddDiscoveryNote,
  useFlagDiscovery,
  usePatchJurisdiction,
  useSaveDiscoveryDraft,
  useSaveJurisdictionContacts,
} from "@/features/discovery/use-discovery"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

const LIST = queryKeys.jurisdictions.list({ filter: "needs_mapping" })
const BOUNDARY = queryKeys.jurisdictions.geometry("0644000")

async function runWrite<I>(
  useHook: () => { mutateAsync: (input: I) => Promise<unknown> },
  input: I,
) {
  const client = makeTestQueryClient()
  client.setQueryData(LIST, { pages: [], pageParams: [] })
  client.setQueryData(BOUNDARY, { geoid: "0644000" })
  const { result } = renderHook(useHook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  await act(() => result.current.mutateAsync(input))
  return client
}

describe("discovery writes refresh the directory but never the boundary", () => {
  it.each([
    ["patch", "patchJurisdiction", () => usePatchJurisdiction(), {
      request: { geoid: "0644000", flagged: true },
      org: "Los Angeles",
      action: "flag" as const,
    }],
    ["save & route", "saveJurisdictionContacts", () => useSaveJurisdictionContacts(), {
      request: { geoid: "0644000", contacts: {} },
      org: "Los Angeles",
    }],
    ["note", "addDiscoveryNote", () => useAddDiscoveryNote(), { id: "0644000", note: "Called" }],
    ["flag", "flagDiscovery", () => useFlagDiscovery(), { id: "0644000", flagged: true }],
    ["draft", "saveDiscoveryDraft", () => useSaveDiscoveryDraft(), { id: "0644000", contacts: {} }],
  ] as const)("%s", async (_name, method, useHook, input) => {
    apiMock[method].mockResolvedValue({ ok: true })
    const client = await runWrite(useHook as never, input)
    expect(client.getQueryState(LIST)?.isInvalidated).toBe(true)
    expect(client.getQueryState(BOUNDARY)?.isInvalidated).toBe(false)
  })
})

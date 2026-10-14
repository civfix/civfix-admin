import type { ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { apiMock } from "@/test/api-mock"
import { makeTestQueryClient } from "@/test/render"
import { useCancelEvent, useFlagEvent, useSetEventOutcome } from "@/features/events/use-events"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

async function invalidatedBy<I>(
  useHook: () => { mutateAsync: (input: I) => Promise<unknown> },
  input: I,
): Promise<unknown[]> {
  const client = makeTestQueryClient()
  const spy = vi.spyOn(client, "invalidateQueries")
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(useHook, { wrapper })
  await act(() => result.current.mutateAsync(input))
  return spy.mock.calls.map(([filters]) => filters?.queryKey)
}

describe("event mutations refresh the sections that show event state", () => {
  it.each([
    ["flag", "flagEvent", () => useFlagEvent(), { id: "e1" }],
    ["cancel", "cancelEvent", () => useCancelEvent(), { id: "e1" }],
    ["outcome", "setEventOutcome", () => useSetEventOutcome(), { id: "e1", bags: 3 }],
  ] as const)("%s", async (_name, method, useHook, input) => {
    apiMock[method].mockResolvedValue({ ok: true })
    const keys = await invalidatedBy(useHook as never, input)
    expect(keys).toEqual(
      expect.arrayContaining([
        queryKeys.events.all,
        queryKeys.users.all,
        queryKeys.orgs.all,
        queryKeys.pages.all,
      ]),
    )
  })
})

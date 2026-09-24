import type { ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { apiMock } from "@/test/api-mock"
import { makeTestQueryClient } from "@/test/render"
import {
  useAppealModeration,
  useApproveModeration,
  useHoldModeration,
  useRemoveModeration,
} from "@/features/moderation/use-moderation"
import { useApproveGovClaim } from "@/features/moderation/use-gov-claims"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

function wrapperFor(client: ReturnType<typeof makeTestQueryClient>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

async function invalidatedBy<I>(
  useHook: () => { mutateAsync: (input: I) => Promise<unknown> },
  input: I,
): Promise<unknown[]> {
  const client = makeTestQueryClient()
  const spy = vi.spyOn(client, "invalidateQueries")
  const { result } = renderHook(useHook, { wrapper: wrapperFor(client) })
  await act(() => result.current.mutateAsync(input))
  return spy.mock.calls.map(([filters]) => filters?.queryKey)
}

describe("moderation decisions refresh the sections the decision changes", () => {
  it.each([
    ["approve", "approveModeration", () => useApproveModeration(), { id: "m1" }],
    ["remove", "removeModeration", () => useRemoveModeration(), { id: "m1" }],
    ["hold", "holdModeration", () => useHoldModeration(), { id: "m1" }],
    ["appeal", "appealModeration", () => useAppealModeration(), { id: "m1", decision: "uphold" as const }],
  ] as const)("%s", async (_name, method, useHook, input) => {
    apiMock[method].mockResolvedValue({ ok: true })
    const keys = await invalidatedBy(useHook as never, input)
    expect(keys).toEqual(
      expect.arrayContaining([
        queryKeys.moderation.all,
        queryKeys.reports.all,
        queryKeys.events.all,
        queryKeys.users.all,
        queryKeys.pages.all,
      ]),
    )
  })
})

describe("gov claim approval", () => {
  it("shows its own error copy, so it opts out of the central error toast", async () => {
    apiMock.approveGovClaim.mockRejectedValue(new Error("boom"))
    const client = makeTestQueryClient()
    const { result } = renderHook(() => useApproveGovClaim(), { wrapper: wrapperFor(client) })
    await act(async () => {
      await result.current.mutateAsync({ id: "gc-1" }).catch(() => undefined)
    })
    expect(client.getMutationCache().getAll()[0]?.meta).toEqual({ errorToast: false })
  })
})

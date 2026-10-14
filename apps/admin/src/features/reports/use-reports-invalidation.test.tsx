import type { ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { queryKeys } from "@/lib/query"
import { apiMock } from "@/test/api-mock"
import { makeTestQueryClient } from "@/test/render"
import { useFlagReport, useRemoveReport, useSetReportStatus } from "@/features/reports/use-reports"

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

describe("report mutations refresh the sections that show report state", () => {
  it.each([
    ["status", "setReportStatus", () => useSetReportStatus(), { id: "r1", status: "resolved" as const }],
    ["flag", "flagReport", () => useFlagReport(), { id: "r1" }],
    ["remove", "removeReport", () => useRemoveReport(), { id: "r1" }],
  ] as const)("%s", async (_name, method, useHook, input) => {
    apiMock[method].mockResolvedValue({ ok: true })
    const keys = await invalidatedBy(useHook as never, input)
    expect(keys).toEqual(
      expect.arrayContaining([
        queryKeys.reports.all,
        queryKeys.users.all,
        queryKeys.events.all,
        queryKeys.moderation.all,
      ]),
    )
  })
})

import type { ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AppError, ErrorCode } from "@civfix/shared"

import type * as ApiModule from "@/lib/api"
import { makeQueryClient, queryKeys } from "@/lib/query"
import { useUiStore } from "@/store/ui-store"
import { apiMock } from "@/test/api-mock"
import { makeTestQueryClient } from "@/test/render"
import {
  useAppealModeration,
  useApproveModeration,
  useHoldModeration,
  useRemoveModeration,
} from "@/features/moderation/use-moderation"
import { useApproveGovClaim } from "@/features/moderation/use-gov-claims"
import { govClaimApproveErrorMessage } from "@/features/moderation/gov-claim-presentation"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

afterEach(() => {
  useUiStore.setState({ toast: null })
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

const SUBJECT = { flag: "MOD-101", kind: "user_report" } as const

describe("moderation decisions refresh the sections the decision changes", () => {
  it.each([
    ["approve", "approveModeration", () => useApproveModeration(), { id: "m1" }],
    ["remove", "removeModeration", () => useRemoveModeration(), { id: "m1" }],
    ["hold", "holdModeration", () => useHoldModeration(), { id: "m1" }],
    ["appeal", "appealModeration", () => useAppealModeration(), { id: "m1", decision: "uphold" as const }],
  ] as const)("%s", async (_name, method, useHook, request) => {
    apiMock[method].mockResolvedValue({ ok: true })
    const keys = await invalidatedBy(useHook as never, { request, item: SUBJECT })
    expect(apiMock[method]).toHaveBeenCalledWith(request)
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

describe("moderation decisions confirm from the item the operator decided", () => {
  it.each([
    ["approve", "approveModeration", () => useApproveModeration(), { id: "m1" }, "image", "MOD-101 · approved"],
    ["keep", "approveModeration", () => useApproveModeration(), { id: "m1" }, "user_report", "MOD-101 · kept"],
    ["remove", "removeModeration", () => useRemoveModeration(), { id: "m1" }, "image", "MOD-101 · removed"],
    ["hold", "holdModeration", () => useHoldModeration(), { id: "m1" }, "image", "MOD-101 · held for review"],
    [
      "uphold",
      "appealModeration",
      () => useAppealModeration(),
      { id: "m1", decision: "uphold" as const },
      "appeal",
      "MOD-101 · appeal upheld",
    ],
    [
      "overturn",
      "appealModeration",
      () => useAppealModeration(),
      { id: "m1", decision: "overturn" as const },
      "appeal",
      "MOD-101 · appeal overturned",
    ],
  ] as const)("%s", async (_name, method, useHook, request, kind, text) => {
    apiMock[method].mockResolvedValue({ ok: true })
    await invalidatedBy(useHook as never, { request, item: { flag: "MOD-101", kind } })
    expect(useUiStore.getState().toast).toMatchObject({ text, tone: "ok" })
  })
})

describe("gov claim approval", () => {
  it("shows its own error copy once, in the error tone", async () => {
    apiMock.approveGovClaim.mockRejectedValue(new AppError(ErrorCode.FORBIDDEN, "Forbidden"))
    const client = makeQueryClient()
    const { result } = renderHook(() => useApproveGovClaim(), { wrapper: wrapperFor(client) })
    await act(async () => {
      await result.current
        .mutateAsync({ request: { id: "gc-1" }, claim: { name: "Maya Rivera" } })
        .catch(() => undefined)
    })
    expect(useUiStore.getState().toast).toMatchObject({
      text: govClaimApproveErrorMessage(new AppError(ErrorCode.FORBIDDEN, "Forbidden")),
      tone: "error",
    })
    expect(useUiStore.getState().toast?.text).toMatch(/^That contact email belongs to an operator account\./)
  })
})

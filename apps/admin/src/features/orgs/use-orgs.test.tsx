import { afterEach, describe, expect, it, vi } from "vitest"
import type { AdminOrgDTO } from "@civfix/shared"

import type * as ApiModule from "@/lib/api"
import { useUiStore } from "@/store/ui-store"
import { apiMock } from "@/test/api-mock"
import { runMutation } from "@/test/mutation"
import {
  useAddOrgMember,
  useDecideOrgVerification,
  useSetOrgMemberRole,
  useSetOrgSuspended,
} from "@/features/orgs/use-orgs"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

afterEach(() => {
  useUiStore.setState({ toast: null })
})

const RIVER = { id: "org-1", name: "River Keepers" } as AdminOrgDTO

function toastText(): string | undefined {
  expect(useUiStore.getState().toast?.tone).toBe("ok")
  return useUiStore.getState().toast?.text
}

describe("organization confirmations", () => {
  it.each([
    [{ decision: "verified", kind: "nonprofit" }, "River Keepers verified · Nonprofit"],
    [{ decision: "verified" }, "River Keepers verified"],
    [{ decision: "rejected" }, "River Keepers rejected"],
  ] as const)("words a verification decision %j", async (decision, text) => {
    apiMock.adminDecideOrgVerification.mockResolvedValue(RIVER)
    await runMutation(() => useDecideOrgVerification(), { id: RIVER.id, ...decision })
    expect(toastText()).toBe(text)
  })

  it.each([
    [true, "River Keepers suspended"],
    [false, "River Keepers restored"],
  ])("words suspended %s", async (suspended, text) => {
    apiMock.adminSetOrgSuspended.mockResolvedValue(RIVER)
    await runMutation(() => useSetOrgSuspended(), { id: RIVER.id, suspended, reason: "Spam" })
    expect(toastText()).toBe(text)
  })

  it.each([
    ["owner", "Ada Lovelace now owns River Keepers"],
    ["admin", "Ada Lovelace added as admin"],
  ] as const)("words adding a member as %s", async (role, text) => {
    apiMock.adminAddOrgMember.mockResolvedValue({ ok: true })
    await runMutation(() => useAddOrgMember(), {
      request: { id: RIVER.id, userId: "u-1", role, reason: "Requested" },
      memberName: "Ada Lovelace",
      orgName: RIVER.name,
    })
    expect(toastText()).toBe(text)
  })

  it.each([
    ["owner", "Ada Lovelace now owns River Keepers"],
    ["member", "Ada Lovelace · Member"],
  ] as const)("words a role change to %s", async (role, text) => {
    apiMock.adminSetOrgMemberRole.mockResolvedValue({ ok: true })
    await runMutation(() => useSetOrgMemberRole(), {
      request: { id: RIVER.id, userId: "u-1", role, reason: "Requested" },
      memberName: "Ada Lovelace",
      orgName: RIVER.name,
    })
    expect(toastText()).toBe(text)
  })
})

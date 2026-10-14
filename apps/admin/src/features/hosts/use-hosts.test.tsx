import { afterEach, describe, expect, it, vi } from "vitest"

import type * as ApiModule from "@/lib/api"
import { useUiStore } from "@/store/ui-store"
import { apiMock } from "@/test/api-mock"
import { runMutation } from "@/test/mutation"
import { useSetHostMessagingSuspended } from "@/features/hosts/use-hosts"

vi.mock("@/lib/api", async (importOriginal) => {
  const { apiMock } = await import("@/test/api-mock")
  return { ...(await importOriginal<typeof ApiModule>()), api: apiMock }
})

afterEach(() => {
  useUiStore.setState({ toast: null })
})

describe("host messaging confirmations", () => {
  it.each([
    [true, "Messaging suspended · Ada Lovelace"],
    [false, "Messaging restored · Ada Lovelace"],
  ])("words the server's answer, suspended %s, not the request", async (suspended, text) => {
    apiMock.adminSetHostMessagingSuspended.mockResolvedValue({ ok: true, suspended })
    await runMutation(() => useSetHostMessagingSuspended(), {
      request: { id: "u-1", suspended: !suspended, reason: "Spamming attendees" },
      hostName: "Ada Lovelace",
    })
    expect(useUiStore.getState().toast).toMatchObject({ text, tone: "ok" })
  })
})

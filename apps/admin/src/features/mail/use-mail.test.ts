import { readFileSync } from "node:fs"

import { MutationObserver, QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

import type * as apiModule from "@/lib/api"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query"

import { publishMailReplyOptions } from "./use-mail"

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  api: { publishMailReply: vi.fn() },
}))

describe("publish reply", () => {
  it("publishes the one message and refreshes the thread, mail lists, reports and events", async () => {
    vi.mocked(api.publishMailReply).mockResolvedValue({ publication: "published" })
    const qc = new QueryClient()
    const keys = [
      queryKeys.mail.detail("t1"),
      queryKeys.mail.list({}),
      queryKeys.reports.detail("r1"),
      queryKeys.events.detail("c1"),
    ]
    for (const key of keys) qc.setQueryData(key, {})

    const res = await new MutationObserver(qc, publishMailReplyOptions(qc)).mutate({
      id: "t1",
      messageId: "m1",
    })

    expect(res).toEqual({ publication: "published" })
    expect(api.publishMailReply).toHaveBeenCalledWith({ id: "t1", messageId: "m1" })
    for (const key of keys) expect(qc.getQueryState(key)?.isInvalidated).toBe(true)
  })

  it("asks the operator to confirm before publishing", () => {
    const source = readFileSync(new URL("./withheld-reply-note.tsx", import.meta.url), "utf8")
    const confirm = source.indexOf("await confirmDialog(")
    expect(confirm).toBeGreaterThan(-1)
    expect(source.indexOf("if (!ok) return")).toBeGreaterThan(confirm)
    expect(source.indexOf("publish.mutate(")).toBeGreaterThan(source.indexOf("if (!ok) return"))
  })
})

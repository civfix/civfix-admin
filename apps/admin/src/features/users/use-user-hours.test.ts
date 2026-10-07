import { readFileSync } from "node:fs"

import { MutationObserver, QueryClient } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { confirmDialog } from "@/components/shared/dialog"
import type * as apiModule from "@/lib/api"
import { api } from "@/lib/api"
import { makeQueryClient, queryKeys } from "@/lib/query"
import { useUiStore } from "@/store/ui-store"

import { creditUserHoursOptions, voidUserHoursOptions } from "./use-user-hours"
import { REVOKE_CERTIFICATE_COMMAND, affectedCertificateLine } from "./user-hours"

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof apiModule>()),
  api: { voidUserHours: vi.fn(), creditUserHours: vi.fn() },
}))

vi.mock("@/components/shared/dialog", () => ({ confirmDialog: vi.fn() }))

const USER = "00000000-0000-4000-8000-000000000001"
const OTHER_USER = "00000000-0000-4000-8000-000000000002"
const ENTRY = "00000000-0000-4000-8000-0000000000e1"
const EVENT = "00000000-0000-4000-8000-0000000000a1"
const OTHER_EVENT = "00000000-0000-4000-8000-0000000000a2"

function seed(qc: QueryClient) {
  const touched = [
    queryKeys.users.hours(USER),
    queryKeys.users.detail(USER),
    queryKeys.audit.list({}),
    queryKeys.events.detail(EVENT),
  ]
  const untouched = [
    queryKeys.users.hours(OTHER_USER),
    queryKeys.users.detail(OTHER_USER),
    queryKeys.users.reports(USER),
    queryKeys.events.detail(OTHER_EVENT),
  ]
  for (const key of [...touched, ...untouched]) qc.setQueryData(key, {})
  return { touched, untouched }
}

describe("void user hours", () => {
  beforeEach(() => {
    vi.mocked(api.voidUserHours).mockReset()
    vi.mocked(confirmDialog).mockReset().mockResolvedValue(true)
    useUiStore.setState({ toast: null })
  })

  it("sends only the contract fields and refreshes the ledger, profile, audit log and event", async () => {
    vi.mocked(api.voidUserHours).mockResolvedValue({ ok: true, affectedCertificates: [] })
    const qc = new QueryClient()
    const { touched, untouched } = seed(qc)

    const res = await new MutationObserver(qc, voidUserHoursOptions(qc)).mutate({
      id: USER,
      entryId: ENTRY,
      reason: "Credited the wrong person",
      eventId: EVENT,
      userName: "Rosa",
      hours: 2.5,
    })

    expect(res).toEqual({ ok: true, affectedCertificates: [] })
    expect(api.voidUserHours).toHaveBeenCalledWith({
      id: USER,
      entryId: ENTRY,
      reason: "Credited the wrong person",
    })
    for (const key of touched) expect(qc.getQueryState(key)?.isInvalidated).toBe(true)
    for (const key of untouched) expect(qc.getQueryState(key)?.isInvalidated).toBe(false)
  })

  it("leaves every event alone when the voided row had none", async () => {
    vi.mocked(api.voidUserHours).mockResolvedValue({ ok: true, affectedCertificates: [] })
    const qc = new QueryClient()
    seed(qc)

    await new MutationObserver(qc, voidUserHoursOptions(qc)).mutate({
      id: USER,
      entryId: ENTRY,
      reason: "Duplicate adjustment",
      eventId: null,
      userName: "Rosa",
      hours: 1,
    })

    expect(qc.getQueryState(queryKeys.users.hours(USER))?.isInvalidated).toBe(true)
    expect(qc.getQueryState(queryKeys.events.detail(EVENT))?.isInvalidated).toBe(false)
  })

  it("invalidates nothing when the void fails", async () => {
    vi.mocked(api.voidUserHours).mockRejectedValue(new Error("conflict"))
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const { touched } = seed(qc)

    await expect(
      new MutationObserver(qc, voidUserHoursOptions(qc)).mutate({
        id: USER,
        entryId: ENTRY,
        reason: "Already void",
        eventId: EVENT,
        userName: "Rosa",
        hours: 2,
      }),
    ).rejects.toThrow("conflict")
    for (const key of touched) expect(qc.getQueryState(key)?.isInvalidated).toBe(false)
    expect(useUiStore.getState().toast).toBeNull()
    expect(confirmDialog).not.toHaveBeenCalled()
  })

  it("toasts the void and skips the certificate notice when no transcript lists the entry", async () => {
    vi.mocked(api.voidUserHours).mockResolvedValue({ ok: true, affectedCertificates: [] })
    const qc = new QueryClient()

    await new MutationObserver(qc, voidUserHoursOptions(qc)).mutate({
      id: USER,
      entryId: ENTRY,
      reason: "Duplicate adjustment",
      eventId: null,
      userName: "Rosa",
      hours: 2.5,
    })

    expect(useUiStore.getState().toast?.text).toBe("Rosa · 2.5 h voided")
    expect(confirmDialog).not.toHaveBeenCalled()
  })

  it("names the affected transcripts even when no panel is still subscribed to the void", async () => {
    vi.mocked(api.voidUserHours).mockResolvedValue({
      ok: true,
      affectedCertificates: [
        { code: "A1B2C3D4E5F6", issuedAt: "2026-03-14T18:00:00.000Z" },
        { code: "B2C3D4E5F6A1", issuedAt: "2026-05-02T18:00:00.000Z" },
      ],
    })
    const qc = new QueryClient()
    const observer = new MutationObserver(qc, voidUserHoursOptions(qc))
    const perCallOnSuccess = vi.fn()

    await observer.mutate(
      {
        id: USER,
        entryId: ENTRY,
        reason: "Credited the wrong person",
        eventId: EVENT,
        userName: "Rosa",
        hours: 3,
      },
      { onSuccess: perCallOnSuccess },
    )

    expect(perCallOnSuccess).not.toHaveBeenCalled()
    expect(useUiStore.getState().toast?.text).toBe("Rosa · 3 h voided")
    expect(confirmDialog).toHaveBeenCalledTimes(1)
    const request = vi.mocked(confirmDialog).mock.calls[0]![0]
    expect(request.acknowledgeOnly).toBe(true)
    expect(request.danger).toBeUndefined()
    expect(request.body).toContain(REVOKE_CERTIFICATE_COMMAND)
    expect(request.details).toEqual([
      affectedCertificateLine({ code: "A1B2C3D4E5F6", issuedAt: "2026-03-14T18:00:00.000Z" }),
      affectedCertificateLine({ code: "B2C3D4E5F6A1", issuedAt: "2026-05-02T18:00:00.000Z" }),
    ])
  })

  it("asks for a required, bounded reason before voiding, one prompt at a time", () => {
    const source = readFileSync(new URL("./user-hours-panel.tsx", import.meta.url), "utf8")
    const guard = source.indexOf("if (prompting.current || voidHours.isPending) return")
    const prompt = source.indexOf("await promptDialog(")
    const cancelled = source.indexOf("if (reason === null) return")
    const mutate = source.indexOf("voidHours.mutate(")
    expect(guard).toBeGreaterThan(-1)
    expect(prompt).toBeGreaterThan(guard)
    expect(cancelled).toBeGreaterThan(prompt)
    expect(mutate).toBeGreaterThan(cancelled)
    const promptCall = source.slice(prompt, cancelled)
    expect(promptCall).toContain("required: true")
    expect(promptCall).toContain("maxLength: VOID_REASON_MAX")
    expect(source).toContain("const VOID_REASON_MAX = 1000")
  })
})

describe("credit user hours", () => {
  const eventRequest = {
    id: USER,
    kind: "event" as const,
    eventId: EVENT,
    hours: 3.5,
    reason: "Attended before signing up",
  }
  const manualRequest = {
    id: USER,
    kind: "manual" as const,
    hours: 1.25,
    serviceDate: "2026-09-20",
    reason: "Staffed the sign-in table",
  }

  beforeEach(() => {
    vi.mocked(api.creditUserHours).mockReset()
    useUiStore.setState({ toast: null })
  })

  it("sends only the request and refreshes the ledger, profile, audit log and event", async () => {
    vi.mocked(api.creditUserHours).mockResolvedValue({ entryId: ENTRY, totalHours: 6 })
    const qc = new QueryClient()
    const { touched, untouched } = seed(qc)

    const res = await new MutationObserver(qc, creditUserHoursOptions(qc)).mutate({
      request: eventRequest,
      userName: "Rosa",
      showsErrorInline: () => true,
    })

    expect(res).toEqual({ entryId: ENTRY, totalHours: 6 })
    expect(api.creditUserHours).toHaveBeenCalledWith(eventRequest)
    for (const key of touched) expect(qc.getQueryState(key)?.isInvalidated).toBe(true)
    for (const key of untouched) expect(qc.getQueryState(key)?.isInvalidated).toBe(false)
    expect(useUiStore.getState().toast?.text).toBe("Rosa · +3.5 h")
  })

  it("leaves every event alone for a manual adjustment", async () => {
    vi.mocked(api.creditUserHours).mockResolvedValue({ entryId: ENTRY, totalHours: 1.25 })
    const qc = new QueryClient()
    seed(qc)

    await new MutationObserver(qc, creditUserHoursOptions(qc)).mutate({
      request: manualRequest,
      userName: "Rosa",
      showsErrorInline: () => true,
    })

    expect(api.creditUserHours).toHaveBeenCalledWith(manualRequest)
    expect(qc.getQueryState(queryKeys.users.hours(USER))?.isInvalidated).toBe(true)
    expect(qc.getQueryState(queryKeys.events.detail(EVENT))?.isInvalidated).toBe(false)
    expect(useUiStore.getState().toast?.text).toBe("Rosa · +1.25 h")
  })

  it("stays quiet on failure while the form can show the error, invalidating nothing", async () => {
    vi.mocked(api.creditUserHours).mockRejectedValue(new Error("already credited"))
    const qc = makeQueryClient()
    const { touched } = seed(qc)

    await expect(
      new MutationObserver(qc, creditUserHoursOptions(qc)).mutate({
        request: eventRequest,
        userName: "Rosa",
        showsErrorInline: () => true,
      }),
    ).rejects.toThrow("already credited")
    for (const key of touched) expect(qc.getQueryState(key)?.isInvalidated).toBe(false)
    expect(useUiStore.getState().toast).toBeNull()
  })

  it("toasts the failure once, after the form that sent it is gone", async () => {
    vi.mocked(api.creditUserHours).mockRejectedValue(new Error("already credited"))
    const qc = makeQueryClient()
    const toasts: string[] = []
    const unsubscribe = useUiStore.subscribe((state, prev) => {
      if (state.toast && state.toast !== prev.toast) toasts.push(state.toast.text)
    })

    await expect(
      new MutationObserver(qc, creditUserHoursOptions(qc)).mutate({
        request: eventRequest,
        userName: "Rosa",
        showsErrorInline: () => false,
      }),
    ).rejects.toThrow("already credited")
    unsubscribe()
    expect(toasts).toEqual(["already credited"])
  })

  it("confirms a valid draft before crediting, one confirmation at a time", () => {
    const source = readFileSync(new URL("./user-hours-panel.tsx", import.meta.url), "utf8")
    const guard = source.indexOf("if (confirming.current || credit.isPending) return")
    const build = source.indexOf("const request = buildCreditRequest(")
    const invalid = source.indexOf("if (!request) return")
    const confirm = source.indexOf("ok = await confirmDialog(")
    const cancelled = source.indexOf("if (!ok) return")
    const mutate = source.indexOf("credit.mutate(")
    expect(guard).toBeGreaterThan(-1)
    expect(build).toBeGreaterThan(guard)
    expect(invalid).toBeGreaterThan(build)
    expect(confirm).toBeGreaterThan(invalid)
    expect(cancelled).toBeGreaterThan(confirm)
    expect(mutate).toBeGreaterThan(cancelled)
  })
})

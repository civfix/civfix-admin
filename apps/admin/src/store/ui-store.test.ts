// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type * as UiStore from "./ui-store"

type UiStoreModule = typeof UiStore

function setHash(hash: string): void {
  window.history.replaceState(null, "", `/${hash}`)
}

// parseHash runs once at module scope, so the initial route is only observable on a fresh import.
async function loadWithHash(hash: string): Promise<UiStoreModule> {
  setHash(hash)
  vi.resetModules()
  return import("./ui-store")
}

async function initialRoute(hash: string): Promise<{ page: string; focusId: string | null }> {
  const { useUiStore } = await loadWithHash(hash)
  const { page, focusId } = useUiStore.getState()
  return { page, focusId }
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  setHash("")
})

describe("section registry", () => {
  it("lists the routable sections in order", async () => {
    const { SECTIONS } = await loadWithHash("")
    expect(SECTIONS).toEqual([
      "discovery",
      "reports",
      "events",
      "mail",
      "users",
      "moderation",
      "analytics",
      "orgs",
      "hosts",
      "pages",
    ])
  })

  it("labels every page including home", async () => {
    const { PAGE_LABEL } = await loadWithHash("")
    expect(PAGE_LABEL).toEqual({
      home: "Dashboard",
      discovery: "Jurisdictions",
      reports: "Reports",
      events: "Events",
      mail: "Mail",
      users: "Users",
      moderation: "Moderation",
      analytics: "Analytics",
      orgs: "Organizations",
      hosts: "Host messaging",
      pages: "Signup pages",
    })
  })
})

describe("initial route from the hash at module load", () => {
  it("starts on home with no focus for an empty hash", async () => {
    expect(await initialRoute("")).toEqual({ page: "home", focusId: null })
  })

  it("starts on home for a bare #/", async () => {
    expect(await initialRoute("#/")).toEqual({ page: "home", focusId: null })
  })

  it.each([
    "discovery",
    "reports",
    "events",
    "mail",
    "users",
    "moderation",
    "analytics",
    "orgs",
    "hosts",
    "pages",
  ])("opens the %s section with no focus", async (section) => {
    expect(await initialRoute(`#/${section}`)).toEqual({ page: section, focusId: null })
  })

  it("accepts a section without the leading slash", async () => {
    expect(await initialRoute("#reports")).toEqual({ page: "reports", focusId: null })
  })

  it("reads the segment after the section as the focus id", async () => {
    expect(await initialRoute("#/reports/rep-123")).toEqual({ page: "reports", focusId: "rep-123" })
  })

  it("decodes a percent-encoded focus id", async () => {
    expect(await initialRoute("#/users/a%20b%3Ac")).toEqual({ page: "users", focusId: "a b:c" })
  })

  it("keeps a plus sign literal in the focus id", async () => {
    expect(await initialRoute("#/users/a+b")).toEqual({ page: "users", focusId: "a+b" })
  })

  it("passes the mail inbox: prefix through untouched", async () => {
    expect(await initialRoute("#/mail/inbox%3Amsg-1")).toEqual({
      page: "mail",
      focusId: "inbox:msg-1",
    })
    expect(await initialRoute("#/mail/inbox:msg-1")).toEqual({ page: "mail", focusId: "inbox:msg-1" })
  })

  it("joins every segment after the section so orgs id/tab survives", async () => {
    expect(await initialRoute("#/orgs/org-1/members")).toEqual({
      page: "orgs",
      focusId: "org-1/members",
    })
    expect(await initialRoute("#/orgs/org-1%2Fmembers")).toEqual({
      page: "orgs",
      focusId: "org-1/members",
    })
  })

  it("reads a trailing slash as no focus", async () => {
    expect(await initialRoute("#/reports/")).toEqual({ page: "reports", focusId: null })
  })

  it("falls back to home and drops the focus for an unknown section", async () => {
    expect(await initialRoute("#/nope/abc")).toEqual({ page: "home", focusId: null })
  })

  it("treats #/home as an unknown section and lands on home", async () => {
    expect(await initialRoute("#/home/abc")).toEqual({ page: "home", focusId: null })
  })

  it("matches section names case-sensitively", async () => {
    expect(await initialRoute("#/Reports")).toEqual({ page: "home", focusId: null })
  })

  it("ignores a query string after the section", async () => {
    expect(await initialRoute("#/reports?tab=open")).toEqual({ page: "reports", focusId: null })
  })

  it("ignores a query string after the focus id", async () => {
    expect(await initialRoute("#/reports/rep-1?tab=open")).toEqual({ page: "reports", focusId: "rep-1" })
  })

  it("falls back to home with no focus on a malformed percent-encoding at import", async () => {
    expect(await initialRoute("#/reports/%E0%A4%A")).toEqual({ page: "home", focusId: null })
  })

  it("falls back to home for a lone percent sign in the focus id", async () => {
    expect(await initialRoute("#/users/100%")).toEqual({ page: "home", focusId: null })
  })

  it("ignores a malformed percent-encoding in an unknown section", async () => {
    expect(await initialRoute("#/nope/%E0%A4%A")).toEqual({ page: "home", focusId: null })
  })
})

describe("syncFromHash", () => {
  it("re-reads the current hash into the store", async () => {
    const { useUiStore } = await loadWithHash("")
    setHash("#/events/ev-9")
    useUiStore.getState().syncFromHash()
    expect(useUiStore.getState()).toMatchObject({ page: "events", focusId: "ev-9" })
  })

  it("falls back to home with no focus on a malformed percent-encoding", async () => {
    const { useUiStore } = await loadWithHash("#/users/u-1")
    setHash("#/reports/%E0%A4%A")
    expect(() => useUiStore.getState().syncFromHash()).not.toThrow()
    expect(useUiStore.getState()).toMatchObject({ page: "home", focusId: null })
  })

  it("recovers on the next valid hash after a malformed one", async () => {
    const { useUiStore } = await loadWithHash("#/reports/%E0%A4%A")
    setHash("#/events/ev-9")
    useUiStore.getState().syncFromHash()
    expect(useUiStore.getState()).toMatchObject({ page: "events", focusId: "ev-9" })
  })
})

describe("nav", () => {
  it("sets the page and focus, pushes the hash and scrolls to top", async () => {
    const { useUiStore } = await loadWithHash("")
    const push = vi.spyOn(window.history, "pushState")
    useUiStore.getState().nav("reports", "rep-1")
    expect(useUiStore.getState()).toMatchObject({ page: "reports", focusId: "rep-1" })
    expect(push).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith(null, "", "#/reports/rep-1")
    expect(window.location.hash).toBe("#/reports/rep-1")
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it("defaults the focus to null", async () => {
    const { useUiStore } = await loadWithHash("#/reports/rep-1")
    useUiStore.getState().nav("events")
    expect(useUiStore.getState()).toMatchObject({ page: "events", focusId: null })
    expect(window.location.hash).toBe("#/events")
  })

  it("writes #/ for home", async () => {
    const { useUiStore } = await loadWithHash("#/users")
    useUiStore.getState().nav("home")
    expect(window.location.hash).toBe("#/")
    expect(useUiStore.getState()).toMatchObject({ page: "home", focusId: null })
  })

  it("drops a focus id for home, as the hash does", async () => {
    const { useUiStore } = await loadWithHash("")
    useUiStore.getState().nav("home", "stray")
    expect(useUiStore.getState()).toMatchObject({ page: "home", focusId: null })
    expect(window.location.hash).toBe("#/")
  })

  it("treats an empty-string focus like no focus in the hash and the store", async () => {
    const { useUiStore } = await loadWithHash("")
    useUiStore.getState().nav("mail", "")
    expect(window.location.hash).toBe("#/mail")
    expect(useUiStore.getState().focusId).toBeNull()
  })

  it("encodes the whole focus id as one segment", async () => {
    const { useUiStore } = await loadWithHash("")
    useUiStore.getState().nav("orgs", "org-1/members")
    expect(window.location.hash).toBe("#/orgs/org-1%2Fmembers")
    useUiStore.getState().nav("mail", "inbox:msg-1")
    expect(window.location.hash).toBe("#/mail/inbox%3Amsg-1")
  })

  it("does not push a history entry when the hash already matches", async () => {
    const { useUiStore } = await loadWithHash("#/reports/rep-1")
    const push = vi.spyOn(window.history, "pushState")
    useUiStore.getState().nav("reports", "rep-1")
    expect(push).not.toHaveBeenCalled()
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it.each([
    ["reports", "plain-id"],
    ["mail", "inbox:msg-1"],
    ["orgs", "org-1/members"],
    ["users", "a b?c#d%e&f"],
    ["events", "ünïcode-✓"],
  ] as const)("round-trips %s focus %j through the hash", async (page, focusId) => {
    const { useUiStore } = await loadWithHash("")
    useUiStore.getState().nav(page, focusId)
    useUiStore.setState({ page: "home", focusId: null })
    useUiStore.getState().syncFromHash()
    expect(useUiStore.getState()).toMatchObject({ page, focusId })
  })

  it("round-trips a section with no focus", async () => {
    const { useUiStore } = await loadWithHash("")
    useUiStore.getState().nav("analytics")
    useUiStore.setState({ page: "home", focusId: "x" })
    useUiStore.getState().syncFromHash()
    expect(useUiStore.getState()).toMatchObject({ page: "analytics", focusId: null })
  })
})

describe("toast", () => {
  it("starts with no toast", async () => {
    const { useUiStore } = await loadWithHash("")
    expect(useUiStore.getState().toast).toBeNull()
  })

  it("gives every toast a new id, even for the same text", async () => {
    const { useUiStore } = await loadWithHash("")
    useUiStore.getState().showToast("Saved")
    const first = useUiStore.getState().toast
    expect(first?.text).toBe("Saved")
    useUiStore.getState().showToast("Saved")
    const second = useUiStore.getState().toast
    expect(second?.text).toBe("Saved")
    expect(second?.id).not.toBe(first?.id)
  })

  it("shows a success toast unless told otherwise", async () => {
    const { useUiStore } = await loadWithHash("")
    useUiStore.getState().showToast("Saved")
    expect(useUiStore.getState().toast).toMatchObject({ text: "Saved", tone: "ok" })
  })

  it("carries the error tone", async () => {
    const { useUiStore } = await loadWithHash("")
    useUiStore.getState().showToast("Could not save", "error")
    expect(useUiStore.getState().toast).toMatchObject({ text: "Could not save", tone: "error" })
  })

  it("replaces the current toast rather than queueing", async () => {
    const { useUiStore } = await loadWithHash("")
    useUiStore.getState().showToast("first")
    useUiStore.getState().showToast("second")
    expect(useUiStore.getState().toast?.text).toBe("second")
  })

  it("dismisses the toast", async () => {
    const { useUiStore } = await loadWithHash("")
    useUiStore.getState().showToast("Saved")
    useUiStore.getState().dismissToast()
    expect(useUiStore.getState().toast).toBeNull()
  })

  it("gives a toast shown after a dismiss a new id", async () => {
    const { useUiStore } = await loadWithHash("")
    useUiStore.getState().showToast("a")
    const dismissedId = useUiStore.getState().toast?.id
    useUiStore.getState().dismissToast()
    useUiStore.getState().showToast("a")
    const next = useUiStore.getState().toast
    expect(next?.text).toBe("a")
    expect(next?.id).not.toBe(dismissedId)
  })

  it("leaves page and focus alone", async () => {
    const { useUiStore } = await loadWithHash("#/users/u-1")
    useUiStore.getState().showToast("x")
    expect(useUiStore.getState()).toMatchObject({ page: "users", focusId: "u-1" })
  })
})

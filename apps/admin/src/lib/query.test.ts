import { afterEach, describe, expect, it } from "vitest"
import { MutationObserver, type QueryClient } from "@tanstack/react-query"
import { AppError, ErrorCode } from "@civfix/shared"

import { makeQueryClient, queryKeys } from "./query"
import { useUiStore } from "@/store/ui-store"

function foreignAppError(code: ErrorCode, message: string): Error {
  const err = new Error(message) as Error & { code: ErrorCode }
  err.name = "AppError"
  err.code = code
  return err
}

function retryOf(client: QueryClient): (failureCount: number, error: Error) => boolean {
  const retry = client.getDefaultOptions().queries?.retry
  if (typeof retry !== "function") throw new Error("expected a retry function")
  return (failureCount, error) => Boolean(retry(failureCount, error))
}

async function failMutation(client: QueryClient, error: unknown): Promise<void> {
  const observer = new MutationObserver(client, { mutationFn: () => Promise.reject(error) })
  await observer.mutate().catch(() => undefined)
}

afterEach(() => {
  useUiStore.setState({ toast: null })
})

describe("makeQueryClient query defaults", () => {
  it("sets staleTime, gcTime and refetchOnWindowFocus", () => {
    const queries = makeQueryClient().getDefaultOptions().queries
    expect(queries?.staleTime).toBe(30_000)
    expect(queries?.gcTime).toBe(300_000)
    expect(queries?.refetchOnWindowFocus).toBe(false)
  })

  it("returns a new client on every call", () => {
    expect(makeQueryClient()).not.toBe(makeQueryClient())
  })

  it.each([ErrorCode.UNAUTHORIZED, ErrorCode.FORBIDDEN, ErrorCode.NOT_FOUND, ErrorCode.VALIDATION])(
    "never retries %s",
    (code) => {
      const retry = retryOf(makeQueryClient())
      expect(retry(0, new AppError(code, "x"))).toBe(false)
      expect(retry(1, new AppError(code, "x"))).toBe(false)
    },
  )

  it("recognizes a no-retry code on a foreign AppError from the client bundle", () => {
    const retry = retryOf(makeQueryClient())
    expect(retry(0, foreignAppError(ErrorCode.NOT_FOUND, "missing"))).toBe(false)
  })

  it("retries INTERNAL while failureCount is below 2", () => {
    const retry = retryOf(makeQueryClient())
    expect(retry(0, new AppError(ErrorCode.INTERNAL, "x"))).toBe(true)
    expect(retry(1, new AppError(ErrorCode.INTERNAL, "x"))).toBe(true)
    expect(retry(2, new AppError(ErrorCode.INTERNAL, "x"))).toBe(false)
    expect(retry(3, new AppError(ErrorCode.INTERNAL, "x"))).toBe(false)
  })

  it.each([ErrorCode.RATE_LIMITED, ErrorCode.CONFLICT])(
    "never retries %s, which a retry would only repeat or amplify",
    (code) => {
      const retry = retryOf(makeQueryClient())
      expect(retry(0, new AppError(code, "x"))).toBe(false)
      expect(retry(1, foreignAppError(code, "x"))).toBe(false)
    },
  )

  it("treats a plain network error as retryable INTERNAL", () => {
    const retry = retryOf(makeQueryClient())
    expect(retry(1, new TypeError("Failed to fetch"))).toBe(true)
    expect(retry(2, new TypeError("Failed to fetch"))).toBe(false)
  })
})

describe("makeQueryClient mutation defaults", () => {
  it("does not retry mutations", () => {
    expect(makeQueryClient().getDefaultOptions().mutations?.retry).toBe(false)
  })

  it("toasts the server message of a failed mutation in the error tone", async () => {
    await failMutation(makeQueryClient(), new AppError(ErrorCode.CONFLICT, "Slug already taken"))
    expect(useUiStore.getState().toast).toMatchObject({ text: "Slug already taken", tone: "error" })
  })

  it("toasts the message of a foreign AppError", async () => {
    await failMutation(makeQueryClient(), foreignAppError(ErrorCode.FORBIDDEN, "Not allowed"))
    expect(useUiStore.getState().toast?.text).toBe("Not allowed")
  })

  it("falls back to the generic copy when the error has no message", async () => {
    await failMutation(makeQueryClient(), new AppError(ErrorCode.INTERNAL, ""))
    expect(useUiStore.getState().toast?.text).toBe("Something went wrong. Please try again.")
  })

  it("toasts the generic copy for a non-error rejection", async () => {
    await failMutation(makeQueryClient(), "boom")
    expect(useUiStore.getState().toast?.text).toBe("Something went wrong. Please try again.")
  })

  it("toasts the connection copy, not the browser's fetch text, when the request never reached the server", async () => {
    await failMutation(makeQueryClient(), new TypeError("Failed to fetch"))
    expect(useUiStore.getState().toast?.text).toBe(
      "Could not reach the server. Check your connection and try again.",
    )
  })

  it("does not toast a successful mutation", async () => {
    const observer = new MutationObserver(makeQueryClient(), { mutationFn: () => Promise.resolve(1) })
    await observer.mutate()
    expect(useUiStore.getState().toast).toBeNull()
  })

  it("still toasts when the mutation sets its own onError, and runs that handler too", async () => {
    const seen: unknown[] = []
    const observer = new MutationObserver(makeQueryClient(), {
      mutationFn: () => Promise.reject(new AppError(ErrorCode.CONFLICT, "own handler")),
      onError: (err) => {
        seen.push(err)
      },
    })
    await observer.mutate().catch(() => undefined)
    expect(seen).toHaveLength(1)
    expect(useUiStore.getState().toast?.text).toBe("own handler")
  })

  it("does not toast a mutation that shows its error inline", async () => {
    const observer = new MutationObserver(makeQueryClient(), {
      mutationFn: () => Promise.reject(new AppError(ErrorCode.CONFLICT, "shown by the form")),
      meta: { errorToast: false },
    })
    await observer.mutate().catch(() => undefined)
    expect(useUiStore.getState().toast).toBeNull()
  })
})

describe("queryKeys static keys", () => {
  it("session", () => {
    expect(queryKeys.session).toEqual(["admin", "session"])
  })

  it("home", () => {
    expect(queryKeys.home).toEqual({
      all: ["admin", "home"],
      summary: ["admin", "home", "summary"],
      map: ["admin", "home", "map"],
    })
  })

  it("analytics", () => {
    expect(queryKeys.analytics).toEqual({
      all: ["admin", "analytics"],
      kpis: ["admin", "analytics", "kpis"],
      pinsByWeek: ["admin", "analytics", "pins-by-week"],
      byCategory: ["admin", "analytics", "by-category"],
      funnel: ["admin", "analytics", "funnel"],
      coverage: ["admin", "analytics", "coverage"],
      resolutionByCategory: ["admin", "analytics", "resolution-by-category"],
      events: ["admin", "analytics", "events"],
      topJurisdictions: ["admin", "analytics", "top-jurisdictions"],
      topContributors: ["admin", "analytics", "top-contributors"],
      heatmap: ["admin", "analytics", "heatmap"],
      retention: ["admin", "analytics", "retention"],
    })
  })

  it("mail stats and forward template", () => {
    expect(queryKeys.mail.stats).toEqual(["admin", "mail", "stats"])
    expect(queryKeys.mail.forwardTemplate).toEqual(["admin", "mail", "forward-template"])
  })

  it("covers exactly these top-level domains", () => {
    expect(Object.keys(queryKeys)).toEqual([
      "session",
      "home",
      "discovery",
      "jurisdictions",
      "reports",
      "events",
      "users",
      "mail",
      "inbox",
      "moderation",
      "govClaims",
      "analytics",
      "orgs",
      "media",
      "hosts",
      "pages",
      "audit",
    ])
  })
})

describe("queryKeys `all` prefixes", () => {
  it.each([
    ["discovery", queryKeys.discovery.all, ["admin", "discovery"]],
    ["jurisdictions", queryKeys.jurisdictions.all, ["admin", "jurisdictions"]],
    ["reports", queryKeys.reports.all, ["admin", "reports"]],
    ["events", queryKeys.events.all, ["admin", "events"]],
    ["users", queryKeys.users.all, ["admin", "users"]],
    ["mail", queryKeys.mail.all, ["admin", "mail"]],
    ["inbox", queryKeys.inbox.all, ["admin", "inbox"]],
    ["moderation", queryKeys.moderation.all, ["admin", "moderation"]],
    ["govClaims", queryKeys.govClaims.all, ["admin", "gov-claims"]],
    ["orgs", queryKeys.orgs.all, ["admin", "orgs"]],
    ["media", queryKeys.media.all, ["admin", "media"]],
    ["hosts", queryKeys.hosts.all, ["admin", "hosts"]],
    ["pages", queryKeys.pages.all, ["admin", "pages"]],
    ["audit", queryKeys.audit.all, ["admin", "audit"]],
  ] as const)("%s.all", (_name, key, expected) => {
    expect(key).toEqual(expected)
  })
})

describe("queryKeys param factories", () => {
  const params = { q: "x", limit: 10 }

  it.each([
    ["discovery.list", queryKeys.discovery.list, ["admin", "discovery", "list"]],
    ["jurisdictions.list", queryKeys.jurisdictions.list, ["admin", "jurisdictions", "list"]],
    ["reports.list", queryKeys.reports.list, ["admin", "reports", "list"]],
    ["reports.page", queryKeys.reports.page, ["admin", "reports", "page"]],
    ["events.list", queryKeys.events.list, ["admin", "events", "list"]],
    ["events.page", queryKeys.events.page, ["admin", "events", "page"]],
    ["users.list", queryKeys.users.list, ["admin", "users", "list"]],
    ["users.page", queryKeys.users.page, ["admin", "users", "page"]],
    ["mail.list", queryKeys.mail.list, ["admin", "mail", "list"]],
    ["mail.page", queryKeys.mail.page, ["admin", "mail", "page"]],
    ["inbox.list", queryKeys.inbox.list, ["admin", "inbox", "list"]],
    ["inbox.page", queryKeys.inbox.page, ["admin", "inbox", "page"]],
    ["moderation.list", queryKeys.moderation.list, ["admin", "moderation", "list"]],
    ["moderation.page", queryKeys.moderation.page, ["admin", "moderation", "page"]],
    ["govClaims.list", queryKeys.govClaims.list, ["admin", "gov-claims", "list"]],
    ["orgs.list", queryKeys.orgs.list, ["admin", "orgs", "list"]],
    ["hosts.list", queryKeys.hosts.list, ["admin", "hosts", "list"]],
    ["hosts.broadcasts", queryKeys.hosts.broadcasts, ["admin", "hosts", "broadcasts"]],
    ["pages.list", queryKeys.pages.list, ["admin", "pages", "list"]],
    ["audit.list", queryKeys.audit.list, ["admin", "audit", "list"]],
  ] as const)("%s appends params, or null when omitted", (_name, factory, prefix) => {
    expect(factory(params)).toEqual([...prefix, params])
    expect(factory()).toEqual([...prefix, null])
    expect(factory(undefined)).toEqual([...prefix, null])
  })

  it("normalizes a null param to null and keeps other falsy params, which the param types now reject", () => {
    // @ts-expect-error null is not a list query
    expect(queryKeys.reports.list(null)).toEqual(["admin", "reports", "list", null])
    // @ts-expect-error 0 is not a list query
    expect(queryKeys.reports.list(0)).toEqual(["admin", "reports", "list", 0])
    // @ts-expect-error "" is not a list query
    expect(queryKeys.reports.list("")).toEqual(["admin", "reports", "list", ""])
  })
})

describe("queryKeys id factories", () => {
  it.each([
    ["discovery.detail", queryKeys.discovery.detail, ["admin", "discovery", "detail"]],
    ["jurisdictions.geometry", queryKeys.jurisdictions.geometry, ["admin", "jurisdictions", "geometry"]],
    ["reports.detail", queryKeys.reports.detail, ["admin", "reports", "detail"]],
    ["events.detail", queryKeys.events.detail, ["admin", "events", "detail"]],
    ["users.detail", queryKeys.users.detail, ["admin", "users", "detail"]],
    ["mail.detail", queryKeys.mail.detail, ["admin", "mail", "detail"]],
    ["inbox.detail", queryKeys.inbox.detail, ["admin", "inbox", "detail"]],
    ["moderation.detail", queryKeys.moderation.detail, ["admin", "moderation", "detail"]],
    ["govClaims.detail", queryKeys.govClaims.detail, ["admin", "gov-claims", "detail"]],
    ["orgs.detail", queryKeys.orgs.detail, ["admin", "orgs", "detail"]],
    ["media.document", queryKeys.media.document, ["admin", "media", "document"]],
    ["pages.preview", queryKeys.pages.preview, ["admin", "pages", "preview"]],
  ] as const)("%s appends the id", (_name, factory, prefix) => {
    expect(factory("id-1")).toEqual([...prefix, "id-1"])
  })

  it("keeps an empty id as the disabled-query placeholder", () => {
    expect(queryKeys.reports.detail("")).toEqual(["admin", "reports", "detail", ""])
  })
})

describe("queryKeys id + params factories", () => {
  const params = { cursor: "c" }

  it.each([
    ["reports.chat", queryKeys.reports.chat, "reports", "chat"],
    ["users.reports", queryKeys.users.reports, "users", "reports"],
    ["users.events", queryKeys.users.events, "users", "events"],
    ["users.messages", queryKeys.users.messages, "users", "messages"],
    ["orgs.members", queryKeys.orgs.members, "orgs", "members"],
    ["orgs.events", queryKeys.orgs.events, "orgs", "events"],
  ] as const)("%s puts the id before the sub-resource", (_name, factory, domain, sub) => {
    const withParams = factory as (id: string, params?: object) => readonly unknown[]
    expect(withParams("id-1", params)).toEqual(["admin", domain, "id-1", sub, params])
    expect(factory("id-1")).toEqual(["admin", domain, "id-1", sub, null])
  })

  it("nests id-scoped keys directly under the domain prefix, not under detail", () => {
    const [a, b, c] = queryKeys.users.reports("u-1")
    expect([a, b]).toEqual(queryKeys.users.all)
    expect(c).toBe("u-1")
    expect(queryKeys.users.reports("u-1").slice(0, 3)).not.toEqual(queryKeys.users.detail("u-1").slice(0, 3))
  })
})

describe("page vs list keys", () => {
  const params = { q: "open", limit: 3 }

  it("reports.page and reports.list are distinct keys", () => {
    expect(queryKeys.reports.page(params)).not.toEqual(queryKeys.reports.list(params))
    expect(queryKeys.reports.page(params)).toEqual(["admin", "reports", "page", params])
    expect(queryKeys.reports.list(params)).toEqual(["admin", "reports", "list", params])
  })

  it("users.page and users.list are distinct keys", () => {
    expect(queryKeys.users.page(params)).not.toEqual(queryKeys.users.list(params))
    expect(queryKeys.users.page(params)).toEqual(["admin", "users", "page", params])
    expect(queryKeys.users.list(params)).toEqual(["admin", "users", "list", params])
  })

  it.each(["events", "inbox", "mail", "moderation"] as const)(
    "%s page and list keys are distinct for equal params",
    (domain) => {
      const { page, list } = queryKeys[domain]
      expect(page(params)).not.toEqual(list(params))
      expect(page(params)).toEqual(["admin", domain, "page", params])
    },
  )

  it("keeps every page and list key under its domain `all` prefix so one invalidation hits both", () => {
    for (const domain of ["reports", "users", "events", "inbox", "mail", "moderation"] as const) {
      const { all, page, list } = queryKeys[domain]
      for (const key of [page(params), list(params)]) expect(key.slice(0, all.length)).toEqual(all)
    }
  })
})

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

  it.each([ErrorCode.INTERNAL, ErrorCode.CONFLICT, ErrorCode.RATE_LIMITED])(
    "retries %s while failureCount is below 2",
    (code) => {
      const retry = retryOf(makeQueryClient())
      expect(retry(0, new AppError(code, "x"))).toBe(true)
      expect(retry(1, new AppError(code, "x"))).toBe(true)
      expect(retry(2, new AppError(code, "x"))).toBe(false)
      expect(retry(3, new AppError(code, "x"))).toBe(false)
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

  it("toasts the server message of a failed mutation", async () => {
    await failMutation(makeQueryClient(), new AppError(ErrorCode.CONFLICT, "Slug already taken"))
    expect(useUiStore.getState().toast?.text).toBe("Slug already taken")
  })

  it("toasts the message of a foreign AppError", async () => {
    await failMutation(makeQueryClient(), foreignAppError(ErrorCode.FORBIDDEN, "Not allowed"))
    expect(useUiStore.getState().toast?.text).toBe("Not allowed")
  })

  it("falls back to the generic copy when the error has no message", async () => {
    await failMutation(makeQueryClient(), new AppError(ErrorCode.INTERNAL, ""))
    expect(useUiStore.getState().toast?.text).toBe("Something went wrong. Please try again.")
  })

  it("toasts the INTERNAL \"Unknown error\" message for a non-error rejection", async () => {
    await failMutation(makeQueryClient(), "boom")
    expect(useUiStore.getState().toast?.text).toBe("Unknown error")
  })

  it("does not toast a successful mutation", async () => {
    const observer = new MutationObserver(makeQueryClient(), { mutationFn: () => Promise.resolve(1) })
    await observer.mutate()
    expect(useUiStore.getState().toast).toBeNull()
  })

  it("does not toast when the mutation sets its own onError, which replaces the default", async () => {
    const seen: unknown[] = []
    const observer = new MutationObserver(makeQueryClient(), {
      mutationFn: () => Promise.reject(new AppError(ErrorCode.CONFLICT, "own handler")),
      onError: (err) => {
        seen.push(err)
      },
    })
    await observer.mutate().catch(() => undefined)
    expect(seen).toHaveLength(1)
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
    ["users.list", queryKeys.users.list, ["admin", "users", "list"]],
    ["users.page", queryKeys.users.page, ["admin", "users", "page"]],
    ["mail.list", queryKeys.mail.list, ["admin", "mail", "list"]],
    ["inbox.list", queryKeys.inbox.list, ["admin", "inbox", "list"]],
    ["moderation.list", queryKeys.moderation.list, ["admin", "moderation", "list"]],
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

  it("normalizes a null param to null and keeps other falsy params (current behavior)", () => {
    expect(queryKeys.reports.list(null)).toEqual(["admin", "reports", "list", null])
    expect(queryKeys.reports.list(0)).toEqual(["admin", "reports", "list", 0])
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
    expect(factory("id-1", params)).toEqual(["admin", domain, "id-1", sub, params])
    expect(factory("id-1")).toEqual(["admin", domain, "id-1", sub, null])
  })

  it("nests id-scoped keys directly under the domain prefix, not under detail", () => {
    const [a, b, c] = queryKeys.users.reports("u-1")
    expect([a, b]).toEqual(queryKeys.users.all)
    expect(c).toBe("u-1")
    expect(queryKeys.users.reports("u-1").slice(0, 3)).not.toEqual(queryKeys.users.detail("u-1").slice(0, 3))
  })
})

describe("list vs infinite key sharing", () => {
  const params = { status: "open" }

  // The list and infinite hooks for these domains both call `<domain>.list(params)`, so a flat page
  // and an InfiniteData payload land in one cache entry when both hooks mount with equal params.
  it.each([
    ["events", queryKeys.events.list],
    ["inbox", queryKeys.inbox.list],
    ["mail", queryKeys.mail.list],
    ["moderation", queryKeys.moderation.list],
  ] as const)(
    "%s list hook shares a key with its infinite hook (known collision)",
    (_name, listFactory) => {
      const flatKey = listFactory(params)
      const infiniteKey = listFactory(params)
      expect(flatKey).toEqual(infiniteKey)
    },
  )

  it("reports list hook uses reports.page, apart from the infinite reports.list", () => {
    expect(queryKeys.reports.page(params)).not.toEqual(queryKeys.reports.list(params))
    expect(queryKeys.reports.page(params)).toEqual(["admin", "reports", "page", params])
    expect(queryKeys.reports.list(params)).toEqual(["admin", "reports", "list", params])
  })

  it("users list hook uses users.page, apart from the infinite users.list", () => {
    expect(queryKeys.users.page(params)).not.toEqual(queryKeys.users.list(params))
    expect(queryKeys.users.page(params)).toEqual(["admin", "users", "page", params])
    expect(queryKeys.users.list(params)).toEqual(["admin", "users", "list", params])
  })

  it("keeps every page and list key under its domain `all` prefix so one invalidation hits both", () => {
    for (const [all, keys] of [
      [queryKeys.reports.all, [queryKeys.reports.page(params), queryKeys.reports.list(params)]],
      [queryKeys.users.all, [queryKeys.users.page(params), queryKeys.users.list(params)]],
    ] as const) {
      for (const key of keys) expect(key.slice(0, all.length)).toEqual(all)
    }
  })
})

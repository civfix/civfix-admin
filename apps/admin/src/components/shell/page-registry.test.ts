import { describe, expect, it } from "vitest"

import { EXPECTED_EXPORTS } from "./page-registry"

const LOADERS: Record<string, () => Promise<Record<string, unknown>>> = {
  home: () => import("@/features/home/home-page"),
  discovery: () => import("@/features/discovery/discovery-page"),
  reports: () => import("@/features/reports/reports-page"),
  events: () => import("@/features/events/events-page"),
  mail: () => import("@/features/mail/mail-page"),
  users: () => import("@/features/users/users-page"),
  moderation: () => import("@/features/moderation/moderation-page"),
  analytics: () => import("@/features/analytics/analytics-page"),
  orgs: () => import("@/features/orgs/orgs-page"),
  hosts: () => import("@/features/hosts/hosts-page"),
  pages: () => import("@/features/pages/pages-page"),
}

describe("page registry", () => {
  it("covers every lazy section with a loader", () => {
    expect(Object.keys(LOADERS).sort()).toEqual(Object.keys(EXPECTED_EXPORTS).sort())
  })

  it.each(Object.entries(EXPECTED_EXPORTS))(
    "%s resolves to its named export",
    async (page, exportName) => {
      const mod = await LOADERS[page]!()
      expect(typeof mod[exportName]).toBe("function")
    },
  )
})

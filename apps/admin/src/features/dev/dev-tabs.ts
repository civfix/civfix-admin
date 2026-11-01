"use client"

import * as React from "react"

export const DEV_TABS = ["overview", "jobs", "flags", "test-tools", "audit"] as const
export type DevTab = (typeof DEV_TABS)[number]

export const DEV_TAB_LABEL: Record<DevTab, string> = {
  overview: "Overview",
  jobs: "Jobs",
  flags: "Flags",
  "test-tools": "Test tools",
  audit: "Audit",
}

function tabFromHash(hash: string): DevTab {
  const id = hash.replace(/^#/, "")
  return DEV_TABS.find((tab) => tab === id) ?? "overview"
}

/** The open tab lives in the hash, so a reload or a shared link reopens it. */
export function useDevTab(): [DevTab, (tab: DevTab) => void] {
  // The root layout's sign-in gate renders the page only in the browser, never in the static export.
  const [tab, setTab] = React.useState<DevTab>(() => tabFromHash(window.location.hash))

  React.useEffect(() => {
    const sync = () => setTab(tabFromHash(window.location.hash))
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])

  const select = React.useCallback((next: DevTab) => {
    setTab(next)
    window.location.hash = next
  }, [])

  return [tab, select]
}

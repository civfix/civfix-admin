"use client"

import * as React from "react"

import { DialogHost } from "@/components/shared/dialog"
import { AuditTab } from "@/features/dev/audit-tab"
import { ENVIRONMENT_LABEL, ENVIRONMENT_TONE } from "@/features/dev/dev-environment"
import { DEV_TABS, DEV_TAB_LABEL, useDevTab, type DevTab } from "@/features/dev/dev-tabs"
import { DevToastProvider } from "@/features/dev/dev-toast"
import { FlagsTab } from "@/features/dev/flags-tab"
import { JobsTab } from "@/features/dev/jobs-tab"
import { OverviewTab } from "@/features/dev/overview-tab"
import { TestToolsTab } from "@/features/dev/test-tools-tab"
import { useDevEnvironment } from "@/features/dev/use-dev"

const TAB_PANEL: Record<DevTab, () => React.ReactNode> = {
  overview: OverviewTab,
  jobs: JobsTab,
  flags: FlagsTab,
  "test-tools": TestToolsTab,
  audit: AuditTab,
}

function DevHeader() {
  const environment = useDevEnvironment()
  const label = environment ? ENVIRONMENT_LABEL[environment] : null

  React.useEffect(() => {
    document.title = label ? `Developer · ${label}` : "Developer"
  }, [label])

  return (
    <header className="page-head">
      <div className="row-flex">
        <h1>civfix developer</h1>
        {environment && (
          <span className={`pill dev-env-badge ${ENVIRONMENT_TONE[environment]}`}>{label}</span>
        )}
      </div>
      <div className="actions">
        {/* A full load, not a client transition: the admin's hash router reads its route once, when
            it loads, so only a fresh load opens it at home. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="btn ghost sm" href="/">
          Back to admin
        </a>
      </div>
    </header>
  )
}

/**
 * Its own page beside the admin shell: it never loads the shell's hash router, so admin's `#/section`
 * hashes never appear here, and it hosts its own toast and confirmations.
 */
export function DevPage() {
  const [tab, selectTab] = useDevTab()
  const panelId = React.useId()
  const Panel = TAB_PANEL[tab]

  return (
    <DevToastProvider>
      <div className="shell-flat">
        <div className="main">
          <DevHeader />
          <main className="dev-body">
            <div className="seg dev-tabs" role="tablist" aria-label="Developer sections">
              {DEV_TABS.map((id) => (
                <button
                  key={id}
                  id={`${panelId}-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={tab === id ? panelId : undefined}
                  className={`seg-btn ${tab === id ? "active" : ""}`}
                  onClick={() => selectTab(id)}
                >
                  {DEV_TAB_LABEL[id]}
                </button>
              ))}
            </div>
            <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-${tab}`}>
              <Panel />
            </div>
          </main>
        </div>
      </div>
      <DialogHost />
    </DevToastProvider>
  )
}

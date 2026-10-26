"use client"

import * as React from "react"
import type { FilingGroup, FilingSettingsDTO, ListFilingsResponse } from "@civfix/contract"

import { Icons } from "@/components/icons"
import { ErrorState } from "@/components/shared/data-states"
import { confirmDialog } from "@/components/shared/dialog"
import { EmptyState, PageHead } from "@/components/shared/page-primitives"
import { ListStates, LoadMoreButton } from "@/components/shared/section-list"
import { flatPages } from "@/lib/infinite"
import { FilingRow } from "@/features/filings/filing-row"
import {
  useFilingList,
  useFilingSettings,
  useSetFilingSettings,
} from "@/features/filings/use-filings"
import type { SectionPageProps } from "@/components/shell/page-registry"

type FilingCounts = ListFilingsResponse["counts"]

const TABS: { group: FilingGroup; label: string; empty: string; counted: keyof FilingCounts | null }[] = [
  { group: "needs_human", label: "Needs a human", empty: "Nothing needs a human", counted: "needs_human" },
  { group: "in_progress", label: "In progress", empty: "Nothing in progress", counted: "in_progress" },
  { group: "filed", label: "Filed", empty: "Nothing filed yet", counted: null },
  { group: "cancelled", label: "Cancelled", empty: "Nothing cancelled", counted: null },
]

function PauseButton({ settings }: { settings: FilingSettingsDTO }) {
  const setSettings = useSetFilingSettings()
  if (settings.paused) {
    return (
      <button
        type="button"
        className="btn primary"
        disabled={setSettings.isPending}
        onClick={() => setSettings.mutate({ paused: false })}
      >
        Resume automatic filing
      </button>
    )
  }
  const pause = async () => {
    const ok = await confirmDialog({
      title: "Pause automatic filing?",
      body: "Approved reports wait in Queued, and nothing is sent to a city until filing is resumed.",
      confirmLabel: "Pause filing",
    })
    if (ok) setSettings.mutate({ paused: true })
  }
  return (
    <button type="button" className="btn" disabled={setSettings.isPending} onClick={pause}>
      Pause automatic filing
    </button>
  )
}

function SettingsBanners({ settings }: { settings: FilingSettingsDTO }) {
  return (
    <>
      {settings.paused && (
        <div className="org-banner tone-alert" role="status">
          <Icons.Clock size={14} />
          <div>Automatic filing is paused. Approved reports wait in Queued.</div>
        </div>
      )}
      {!settings.automaticFiling && (
        <div className="org-banner" role="status">
          <Icons.AlertTriangle size={14} />
          <div>Automatic filing is off in this environment. Portal filings go to Needs a human.</div>
        </div>
      )}
    </>
  )
}

function FilingTabs({
  group,
  counts,
  panelId,
  onChange,
}: {
  group: FilingGroup
  counts: FilingCounts | undefined
  panelId: string
  onChange: (group: FilingGroup) => void
}) {
  return (
    <div className="profile-tabs" role="tablist" aria-label="Filings">
      {TABS.map((tab) => {
        const selected = tab.group === group
        return (
          <button
            key={tab.group}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            className={`profile-tab ${selected ? "on" : ""}`}
            onClick={() => onChange(tab.group)}
          >
            {tab.label}
            {tab.counted && counts && <span className="profile-tab-n">{counts[tab.counted]}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function FilingsPage(_props: SectionPageProps) {
  const [group, setGroup] = React.useState<FilingGroup>("needs_human")
  const listQuery = useFilingList(group)
  const settingsQuery = useFilingSettings()
  const items = React.useMemo(() => flatPages(listQuery.data), [listQuery.data])
  const panelId = React.useId()
  // Every page carries the counts; keep the last ones while another tab's first page loads.
  const pageCounts = listQuery.data?.pages.at(-1)?.counts
  const [counts, setCounts] = React.useState(pageCounts)
  if (pageCounts && pageCounts !== counts) setCounts(pageCounts)
  const tab = TABS.find((t) => t.group === group)!
  const settings = settingsQuery.data

  return (
    <>
      <PageHead
        title="Filings"
        subtitle={
          <span>
            Approved reports on their way to the city: the ones that need an operator first, then the
            ones in progress, filed and cancelled.
          </span>
        }
      >
        {settings && <PauseButton settings={settings} />}
      </PageHead>

      {settings && <SettingsBanners settings={settings} />}
      {settingsQuery.isError && (
        <ErrorState
          error={settingsQuery.error}
          onRetry={() => void settingsQuery.refetch()}
          title="Could not load the filing settings"
        />
      )}

      <section className="card">
        <FilingTabs group={group} counts={counts} panelId={panelId} onChange={setGroup} />
        <div className="queue-list" role="tabpanel" id={panelId} aria-label={tab.label}>
          <ListStates
            query={listQuery}
            loadingLabel="Loading filings..."
            isEmpty={items.length === 0}
            empty={<EmptyState title={tab.empty} icon={<Icons.Inbox size={20} />} />}
          >
            {items.map((filing) => (
              <FilingRow key={filing.id} filing={filing} />
            ))}
            <LoadMoreButton query={listQuery} className="list-load-more" />
          </ListStates>
        </div>
      </section>
    </>
  )
}

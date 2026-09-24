"use client"

import * as React from "react"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { useDebounced } from "@/hooks/use-debounced"
import { CreateOrgPanel } from "@/features/orgs/create-org-panel"
import { OrgDetail } from "@/features/orgs/org-detail"
import { OrgList } from "@/features/orgs/org-list"
import {
  ORG_FILTERS,
  ORG_FILTER_LABEL,
  isOrgFilter,
  orgFilterCount,
  orgListParams,
  type OrgFilter,
} from "@/features/orgs/orgs-filters"
import { parseOrgFocus, type OrgDetailTab } from "@/features/orgs/org-focus"
import { useOrgsInfinite } from "@/features/orgs/use-orgs"
import type { SectionPageProps } from "@/components/shell/page-registry"

const SEARCH_DEBOUNCE_MS = 250

/**
 * Only the first load picks an org on the operator's behalf; a deep-linked or just-created org is
 * pinned like any other pick. A pick that a filter or search leaves out stays open (the detail reads it
 * by id); a pick that drops out of the same list after a refetch (a verification decision under the
 * Pending chip) clears, so the pane never jumps to another org's actions. Each decision waits for data
 * fetched for the current params: a cached page that is refetching may not have the org created since.
 */
function useListSelection({
  selId,
  setSelId,
  initialAutoPick,
  listQuery,
  items,
  listKey,
}: {
  selId: string | null
  setSelId: (id: string | null) => void
  initialAutoPick: boolean
  listQuery: ReturnType<typeof useOrgsInfinite>
  items: { id: string }[]
  listKey: string
}) {
  const [autoPick, setAutoPick] = React.useState(initialAutoPick)
  const seenIn = React.useRef<{ id: string; list: string } | null>(null)
  React.useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isFetching) return
    if (selId === null) {
      if (autoPick && items.length) setSelId(items[0]!.id)
      return
    }
    setAutoPick(false)
    if (items.some((o) => o.id === selId)) seenIn.current = { id: selId, list: listKey }
    else if (seenIn.current?.id === selId && seenIn.current.list === listKey) setSelId(null)
  }, [listQuery.isSuccess, listQuery.isFetching, items, selId, listKey, autoPick, setSelId])
}

export function OrgsPage({ focusId }: SectionPageProps) {
  const focus = React.useMemo(() => parseOrgFocus(focusId), [focusId])
  const [filter, setFilter] = React.useState<OrgFilter>("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focus.id)
  const [tab, setTab] = React.useState<OrgDetailTab>(focus.tab ?? "profile")
  const [creating, setCreating] = React.useState(false)

  const debouncedQuery = useDebounced(query, SEARCH_DEBOUNCE_MS)
  const listParams = React.useMemo(
    () => orgListParams(filter, debouncedQuery),
    [filter, debouncedQuery],
  )
  const listQuery = useOrgsInfinite(listParams)
  const items = React.useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  )
  const counts = listQuery.data?.pages[0]?.counts
  const pendingCount = counts?.pending
  const filterTotal = orgFilterCount(counts, filter)
  const pendingView = filter === "pending"

  React.useEffect(() => {
    if (focus.id) setSelId(focus.id)
    if (focus.tab) setTab(focus.tab)
  }, [focus])
  useListSelection({
    selId,
    setSelId,
    initialAutoPick: focus.id === null,
    listQuery,
    items,
    listKey: JSON.stringify(listParams),
  })

  const pickFilter = (next: string) => {
    if (!isOrgFilter(next)) return
    setFilter(next)
    if (next === "pending") setTab("verification")
    else if (tab === "verification") setTab("profile")
  }

  return (
    <>
      <PageHead
        title="Organizations"
        subtitle={
          <span>
            Nonprofits, agencies and community groups that host on civfix. Create and manage them,
            verify who they say they are, and keep their members and events in order.
          </span>
        }
        meta={pendingCount !== undefined ? <span>{pendingCount} awaiting review</span> : undefined}
      >
        <button type="button" className="btn primary" onClick={() => setCreating(true)}>
          <Icons.Plus size={14} /> New organization
        </button>
      </PageHead>

      <div className="toolbar">
        <FilterChips
          options={ORG_FILTERS.map((f) => ({
            value: f,
            label: ORG_FILTER_LABEL[f],
            count: orgFilterCount(counts, f),
          }))}
          value={filter}
          onChange={pickFilter}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            aria-label="Search organizations"
            placeholder="Search name or slug…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>{pendingView ? "Verification queue" : "Organizations"}</h3>
            <div className="spacer" />
            <span className="meta">
              {items.length}
              {filterTotal !== undefined ? ` of ${filterTotal}` : ""}
            </span>
          </div>
          <div className="queue-list">
            <OrgList
              listQuery={listQuery}
              items={items}
              pendingView={pendingView}
              selId={selId}
              onSelect={setSelId}
            />
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            <OrgDetail key={selId} orgId={selId} tab={tab} onTab={setTab} />
          ) : (
            <EmptyState
              title="No organization selected"
              sub="Pick an organization from the list, or create one."
              icon={<Icons.Building size={20} />}
            />
          )}
        </section>
      </div>

      <CreateOrgPanel
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(org) => {
          setCreating(false)
          setFilter("all")
          setQuery("")
          setTab("profile")
          setSelId(org.id)
        }}
      />
    </>
  )
}

"use client"

import * as React from "react"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { ListCard, SearchBox } from "@/components/shared/section-list"
import { useDebounced } from "@/hooks/use-debounced"
import { idOf, useSelection } from "@/hooks/use-selection"
import { flatPages } from "@/lib/infinite"
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
import { useOrgListInfinite } from "@/features/orgs/use-orgs"
import type { SectionPageProps } from "@/components/shell/page-registry"

export function OrgsPage({ focusId }: SectionPageProps) {
  const focus = React.useMemo(() => parseOrgFocus(focusId), [focusId])
  const [filter, setFilter] = React.useState<OrgFilter>("all")
  const [query, setQuery] = React.useState("")
  const [tab, setTab] = React.useState<OrgDetailTab>(focus.tab ?? "profile")
  const [creating, setCreating] = React.useState(false)

  const debouncedQuery = useDebounced(query)
  const listParams = React.useMemo(
    () => orgListParams(filter, debouncedQuery),
    [filter, debouncedQuery],
  )
  const listQuery = useOrgListInfinite(listParams)
  const items = React.useMemo(
    () => flatPages(listQuery.data),
    [listQuery.data],
  )
  const counts = listQuery.data?.pages[0]?.counts
  const pendingCount = counts?.pending
  const filterTotal = orgFilterCount(counts, filter)
  const pendingView = filter === "pending"

  // A just-created org is pinned like any other pick. The focus also carries a tab, so a deep link to
  // the same org with another tab must still re-select it.
  const { selectedId: selId, setSelectedId: setSelId } = useSelection({
    focusId: focus.id,
    syncFocus: false,
    list: listQuery,
    items,
    getId: idOf,
    listKey: JSON.stringify(listParams),
  })
  React.useEffect(() => {
    if (focus.id) setSelId(focus.id)
    if (focus.tab) setTab(focus.tab)
  }, [focus, setSelId])

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
        <SearchBox
          label="Search organizations"
          placeholder="Search name or slug…"
          value={query}
          onChange={setQuery}
        />
      </div>

      <div className="master-detail">
        <ListCard
          title={pendingView ? "Verification queue" : "Organizations"}
          meta={
            <>
              {items.length}
              {filterTotal !== undefined ? ` of ${filterTotal}` : ""}
            </>
          }
        >
          <OrgList
            listQuery={listQuery}
            items={items}
            pendingView={pendingView}
            selId={selId}
            onSelect={setSelId}
          />
        </ListCard>

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

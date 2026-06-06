"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import {
  REPORT_CATEGORY_LABELS,
  type DiscoveryContact,
  type DiscoveryTaskDTO,
  type GetDiscoveryTaskResponse,
  type PerCategoryCounts,
  type ReportCategory,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import type { MapPin } from "@/components/map/leaflet-map"
import {
  useAddDiscoveryNote,
  useDiscoveryList,
  useDiscoveryTask,
  useFlagDiscovery,
  useSaveDiscoveryDraft,
  useSaveJurisdictionContacts,
} from "@/features/discovery/use-discovery"
import { useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Jurisdictions / discovery queue (ported from pages-discovery.jsx, enumeration 2.B). Master-detail:
 * the population-sorted queue on the left (filter chips All / Need attention / No action required,
 * search, sort) and the per-jurisdiction contact-research panel on the right. The right panel writes a
 * per-category routing contact for the GEOID ("Save & route"), saves a draft, flags for review, and
 * appends operator notes - all via the typed admin client (no window.DATA).
 *
 * Difference from the prototype: the per-category counts come from the task's real `perCategoryCounts`
 * and the prefilled emails from the task's stored `contacts[]` (the prototype synthesized both with a
 * hash-seeded mock). "needs contact / routed" is driven by the server's `contactState`.
 */

// Client-only Leaflet minimap (must not run during the static export). Single dynamic import reused for
// the jurisdiction mini-map; pins are the task's sample report pins.
const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="pi-map-canvas" aria-busy="true" />,
})

/** The 6 civfix report categories + a synthetic "Other" row, in the order the routing grid renders. */
const REPORT_TYPES: { id: ReportCategory; label: string }[] = (
  Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[]
).map((id) => ({ id, label: REPORT_CATEGORY_LABELS[id] }))

/** Pin asset for a category. "other" has no pin (rendered as a Layers glyph by the caller). */
function catPinSrc(category: ReportCategory): string | null {
  if (category === "other") return null
  return `/ds/pin-${category}.svg`
}

/** A jurisdiction needs attention when any category has waiting reports but no routed contact. */
function needsAttention(task: { perCategoryCounts: PerCategoryCounts; contactState: { missing: ReportCategory[] } }): boolean {
  return task.contactState.missing.some((c) => (task.perCategoryCounts[c] ?? 0) > 0)
}

function DiscoveryRow({
  item,
  selected,
  onClick,
}: {
  item: DiscoveryTaskDTO
  selected: boolean
  onClick: () => void
}) {
  const needs = needsAttention(item)
  const pin = catPinSrc(item.category)
  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={onClick}>
      <div className="leading has-pin" title={item.catLabel}>
        {pin ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pin} alt="" />
        ) : (
          <Icons.Layers size={16} />
        )}
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{item.place}</span>
          {needs ? (
            <span className="pill attention tight">
              <span className="dot" />
              Needs contact
            </span>
          ) : (
            <span className="pill status-ok tight">
              <Icons.Check size={9} /> Routed
            </span>
          )}
          <span className="ident">{item.id}</span>
        </div>
        <div className="sub">
          <span className="strong">{fmtPop(item.pop)} pop</span>
          <span className="sep">-</span>
          <span>{item.reports} reports</span>
          <span className="sep">-</span>
          <span>last {item.lastReport}</span>
        </div>
      </div>
      <div className="trailing">
        <span className="age">{item.age}</span>
        <span className="row-arrow">
          <Icons.ChevronRight size={14} />
        </span>
      </div>
    </div>
  )
}

function fmtPop(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k"
  return String(n)
}

/** The jurisdiction mini-map pins (sample report pins for the GEOID), as Leaflet MapPin shapes. */
function toSamplePins(task: GetDiscoveryTaskResponse): MapPin[] {
  return task.samplePins.map((p, i) => ({
    id: `s-${i}`,
    lat: p.lat,
    lng: p.lng,
    category: p.category,
    draft: p.draft,
  }))
}

function DiscoveryDetail({ taskId }: { taskId: string }) {
  const q = useDiscoveryTask(taskId)
  const toast = useToast()

  const addNote = useAddDiscoveryNote()
  const flag = useFlagDiscovery()
  const saveDraft = useSaveDiscoveryDraft()
  const saveContacts = useSaveJurisdictionContacts()

  // Per-category contact emails (controlled inputs), seeded from the task's stored contacts.
  const [contacts, setContacts] = React.useState<Record<string, string>>({})
  const [opNote, setOpNote] = React.useState("")

  const task = q.data
  React.useEffect(() => {
    if (!task) return
    const seed: Record<string, string> = {}
    task.contacts.forEach((c: DiscoveryContact) => {
      if (c.email) seed[c.category] = c.email
    })
    setContacts(seed)
    setOpNote("")
  }, [task])

  if (q.isLoading) return <LoadingState label="Loading jurisdiction..." />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (!task) {
    return (
      <EmptyState
        title="No jurisdiction selected"
        sub="Pick a place from the list."
        icon={<Icons.Pin size={20} />}
      />
    )
  }

  const counts = task.perCategoryCounts
  const setCat = (id: string, email: string) => setContacts((prev) => ({ ...prev, [id]: email }))
  const slug = task.place.split(",")[0]?.toLowerCase().replace(/\s+/g, "-") ?? "city"
  const missingContacts = REPORT_TYPES.filter(
    (c) => (counts[c.id] ?? 0) > 0 && !contacts[c.id],
  ).length
  const filledCount = REPORT_TYPES.filter((c) => contacts[c.id]).length
  const canSave = filledCount > 0
  const needs = needsAttention(task)
  const headPin = catPinSrc(task.category)
  const busy = saveContacts.isPending || saveDraft.isPending || flag.isPending || addNote.isPending

  // Build the per-category contact map for a write (only non-empty emails; cleared ones -> null).
  const contactsPayload = (): Partial<Record<ReportCategory, string | null>> => {
    const out: Partial<Record<ReportCategory, string | null>> = {}
    REPORT_TYPES.forEach((c) => {
      const v = contacts[c.id]?.trim()
      if (v) out[c.id] = v
    })
    return out
  }

  const onAddNote = () => {
    const text = opNote.trim()
    if (!text) return
    addNote.mutate(
      { id: task.id, text },
      {
        onSuccess: () => {
          setOpNote("")
          toast("Note added")
        },
      },
    )
  }

  const onFlag = () => {
    flag.mutate(
      { id: task.id },
      { onSuccess: () => toast(`${task.id} flagged for review`) },
    )
  }

  const onSaveDraft = () => {
    saveDraft.mutate(
      { id: task.id, contacts: contactsPayload() },
      { onSuccess: () => toast(`Draft saved for ${task.place}`) },
    )
  }

  const onSaveAndRoute = () => {
    if (!canSave) return
    saveContacts.mutate(
      { geoid: task.geoid, contacts: contactsPayload() },
      { onSuccess: () => toast(`Contacts saved for ${task.place}. Outreach queued.`) },
    )
  }

  return (
    <div className="rep-detail">
      <div className="rep-head">
        <span className="rep-head-pin">
          {headPin ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={headPin} alt="" style={{ width: 30, height: 30, objectFit: "contain" }} />
          ) : (
            <Icons.Layers size={22} />
          )}
        </span>
        <div className="rep-head-text">
          <div className="crumb">
            {task.id} - Jurisdiction - GEOID {task.geoid}
          </div>
          <h2>{task.place}</h2>
        </div>
        {needs ? (
          <span className="pill attention" style={{ marginLeft: "auto" }}>
            <span className="dot" />
            Needs contact
          </span>
        ) : (
          <span className="pill status-ok" style={{ marginLeft: "auto" }}>
            <Icons.Check size={11} /> Routed
          </span>
        )}
      </div>

      <div className="rep-grid">
        <div className="rep-col">
          {/* Jurisdiction map + stats */}
          <div className="sub">
            <div className="sub-head">Jurisdiction</div>
            <div className="sub-body" style={{ padding: 10 }}>
              <div className="mini-map">
                {task.center && task.samplePins.length > 0 ? (
                  <LeafletMap
                    pins={toSamplePins(task)}
                    center={task.center}
                    zoom={task.zoom ?? 11}
                    tint="voyager"
                    interactive={false}
                  />
                ) : (
                  <div className="juris-label">{task.place}</div>
                )}
              </div>
              <div className="juris-stats">
                <div>
                  <div className="eyebrow">Population</div>
                  <div className="juris-stat-n">{task.pop.toLocaleString()}</div>
                  <div className="juris-stat-sub">TIGER 2024</div>
                </div>
                <div>
                  <div className="eyebrow">Reports waiting</div>
                  <div className="juris-stat-n">{task.reports}</div>
                  <div className="juris-stat-sub">oldest {task.age}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="sub">
            <div className="sub-head">Notes &amp; history</div>
            <div className="sub-body">
              {task.notes.length > 0 && (
                <div className="notes">
                  {task.notes.map((n, i) => (
                    <div
                      // eslint-disable-next-line react/no-array-index-key
                      key={i}
                      className="note"
                    >
                      {n.text}
                      <div className="meta">
                        @{n.who} - {n.when}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div
                className="field"
                style={{ marginTop: task.notes.length ? 8 : 0, marginBottom: 0 }}
              >
                <textarea
                  placeholder="Add a note for the next operator..."
                  value={opNote}
                  onChange={(e) => setOpNote(e.target.value)}
                  rows={3}
                />
              </div>
              <button
                className="btn sm"
                disabled={!opNote.trim() || addNote.isPending}
                onClick={onAddNote}
                style={{ marginTop: 8 }}
              >
                <Icons.Plus size={12} /> Add note
              </button>
            </div>
          </div>
        </div>

        <div className="rep-col">
          {/* Routing contacts */}
          <div className="sub">
            <div className="sub-head">
              Routing contacts
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>
                {missingContacts > 0
                  ? `${missingContacts} type${missingContacts === 1 ? "" : "s"} with no contact`
                  : "all routed"}
              </span>
            </div>
            <div className="sub-body">
              <div className="ccat-grid one-col">
                {REPORT_TYPES.map((c) => {
                  const n = counts[c.id] ?? 0
                  const attention = n > 0 && !contacts[c.id]
                  const pin = catPinSrc(c.id)
                  return (
                    <div
                      key={c.id}
                      className={`ccat-cell ${attention ? "attention" : ""} ${n === 0 ? "quiet" : ""}`}
                    >
                      <div className="ccat-cell-head">
                        {pin ? (
                          <span className="ccat-pin">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={pin} alt="" />
                          </span>
                        ) : (
                          <span className="ccat-other">
                            <Icons.Layers size={13} />
                          </span>
                        )}
                        <span className="ccat-label">{c.label}</span>
                        <span
                          className={`ccat-count ${n > 0 ? "" : "zero"} ${attention ? "warn" : ""}`}
                        >
                          {n} {n === 1 ? "report" : "reports"}
                        </span>
                      </div>
                      <div className="ccat-email">
                        <Icons.Mail size={13} />
                        <input
                          type="email"
                          value={contacts[c.id] ?? ""}
                          placeholder={
                            attention
                              ? "Add a contact - reports waiting"
                              : `${c.id === "other" ? "info" : c.id}@${slug}.gov`
                          }
                          onChange={(e) => setCat(c.id, e.target.value)}
                        />
                        {attention && (
                          <span className="ccat-flag" title="Reports waiting with no contact">
                            <Icons.AlertTriangle size={13} />
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="hint" style={{ marginTop: 10 }}>
                Counts are reports waiting per type - highlighted types have reports but no contact yet.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="rep-actions">
        <span className="rep-actions-label">
          {filledCount} of {REPORT_TYPES.length} contacts set
        </span>
        <div className="spacer" />
        <button className="btn danger" disabled={flag.isPending} onClick={onFlag}>
          <Icons.Flag size={13} /> Flag for review
        </button>
        <button className="btn" disabled={saveDraft.isPending} onClick={onSaveDraft}>
          Save draft
        </button>
        <button
          className={`btn ${canSave ? "success" : ""}`}
          disabled={!canSave || busy}
          onClick={onSaveAndRoute}
          style={!canSave ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
        >
          <Icons.Check size={13} /> Save &amp; route
        </button>
      </div>
    </div>
  )
}

export function DiscoveryPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState("all")
  const [sort, setSort] = React.useState<"pop" | "reports">("pop")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  // The list query carries the full filter/sort/search so different views do not collide in cache.
  const listParams = {
    filter: filter === "all" ? undefined : (filter as "attention" | "clear"),
    sort,
    q: query.trim() || undefined,
  }
  const listQuery = useDiscoveryList(listParams)
  const items = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data])

  // Counts for the filter chips come from an unfiltered fetch so they stay stable across filters.
  const allQuery = useDiscoveryList({ sort: "pop" })
  const allItems = React.useMemo(() => allQuery.data?.items ?? [], [allQuery.data])
  const attentionCount = allItems.filter((x) => needsAttention(x)).length

  // Keep a selection: honor focusId, else fall back to the first row of the current view.
  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.id)
    if (selId && items.length && !items.some((x) => x.id === selId)) {
      setSelId(items[0]!.id)
    }
  }, [items, selId])

  const catFilters = [
    { value: "all", label: "All", count: allItems.length },
    { value: "attention", label: "Need attention", count: attentionCount },
    { value: "clear", label: "No action required", count: allItems.length - attentionCount },
  ]

  return (
    <>
      <PageHead
        title="Jurisdictions"
        subtitle={
          <span>
            Pins are landing in places we do not have a contact for yet. Research the jurisdiction, save
            a routing contact, and reports start flowing.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips options={catFilters} value={filter} onChange={setFilter} />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            placeholder="Search place or ID..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="sortbox">
          <span className="sortbox-label">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as "pop" | "reports")}>
            <option value="pop">Population</option>
            <option value="reports">Reports waiting</option>
          </select>
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>
              {items.length} {items.length === 1 ? "jurisdiction" : "jurisdictions"}
            </h3>
            <div className="spacer" />
            <span className="meta">click a row -&gt;</span>
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading jurisdictions..." />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                title="Nothing matches"
                sub="Try a different filter or search."
                icon={<Icons.Search size={20} />}
              />
            ) : (
              items.map((item) => (
                <DiscoveryRow
                  key={item.id}
                  item={item}
                  selected={selId === item.id}
                  onClick={() => setSelId(item.id)}
                />
              ))
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            <DiscoveryDetail key={selId} taskId={selId} />
          ) : (
            <EmptyState
              title="No jurisdiction selected"
              sub="Pick a place from the list."
              icon={<Icons.Pin size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

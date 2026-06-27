"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import {
  type DiscoveryContact,
  type JurisdictionDirectoryDTO,
  type JurisdictionLayer,
  type PerCategoryCounts,
  type ReportCategory,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { toAppError } from "@/lib/api"
import { promptDialog } from "@/components/shared/dialog"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import {
  useJurisdictionDirectory,
  useJurisdictionGeometry,
  usePatchJurisdiction,
  useSaveJurisdictionContacts,
} from "@/features/discovery/use-discovery"

const BoundaryMap = dynamic(
  () => import("@/components/map/boundary-map").then((m) => m.BoundaryMap),
  { ssr: false },
)
import { useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"


const LAYER_LABEL: Record<JurisdictionLayer, string> = {
  place: "City",
  county: "County",
  state: "State",
  federal: "Federal land",
  tribal: "Tribal",
}

const UNMAPPED_GEOID = "__unmapped__"

function fmtRouted(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const REPORT_TYPES: { id: ReportCategory; label: string; pin: string | null }[] = [
  { id: "trash", label: "Trash", pin: "/ds/pin-trash.svg" },
  { id: "recycling", label: "Recycling", pin: "/ds/pin-recycling.svg" },
  { id: "graffiti", label: "Graffiti", pin: "/ds/pin-graffiti.svg" },
  { id: "hazard", label: "Hazard", pin: "/ds/pin-hazard.svg" },
  { id: "encampment", label: "Encampment", pin: null },
  { id: "water", label: "Water", pin: "/ds/pin-water.svg" },
  { id: "other", label: "Other", pin: null },
]

const CATEGORIES: readonly ReportCategory[] = [
  "trash",
  "recycling",
  "graffiti",
  "hazard",
  "encampment",
  "water",
  "other",
]

const PIN_SRC = new Map<ReportCategory, string>(
  REPORT_TYPES.flatMap((c) => (c.pin ? [[c.id, c.pin] as const] : [])),
)

function routingCount(counts: PerCategoryCounts, id: ReportCategory): number {
  return counts[id] ?? 0
}

function catPinSrc(category: ReportCategory): string | null {
  return PIN_SRC.get(category) ?? null
}

function dominantCategory(counts: PerCategoryCounts): ReportCategory | null {
  let best: ReportCategory | null = null
  let bestN = 0
  for (const c of CATEGORIES) {
    const n = counts[c] ?? 0
    if (n > bestN) {
      bestN = n
      best = c
    }
  }
  return best
}

function needsAttention(dto: JurisdictionDirectoryDTO): boolean {
  return dto.reportsWaiting > 0 && dto.method === "none"
}

function fmtPop(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k"
  return String(n)
}

function JurisdictionRow({
  item,
  selected,
  onClick,
}: {
  item: JurisdictionDirectoryDTO
  selected: boolean
  onClick: () => void
}) {
  const isUnmapped = item.geoid === UNMAPPED_GEOID
  const needs = needsAttention(item)
  const dom = dominantCategory(item.perCategoryCounts)
  const pin = dom ? catPinSrc(dom) : null

  if (isUnmapped) {
    return (
      <div className={`qrow ${selected ? "selected" : ""}`} onClick={onClick}>
        <div className="leading has-pin" title="Unmapped">
          <Icons.AlertTriangle size={16} />
        </div>
        <div className="body">
          <div className="top">
            <span className="title">{item.org}</span>
            <span className="pill attention tight">
              <span className="dot" />
              Needs mapping
            </span>
          </div>
          <div className="sub">
            <span className="strong">{item.reportsWaiting} waiting</span>
            <span className="sep">·</span>
            <span>location didn’t resolve to a jurisdiction</span>
          </div>
        </div>
        <div className="trailing">
          <span className="row-arrow">
            <Icons.ChevronRight size={14} />
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={onClick}>
      <div className="leading has-pin" title={LAYER_LABEL[item.layer]}>
        {pin ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pin} alt="" />
        ) : (
          <Icons.Layers size={16} />
        )}
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{item.org}</span>
          <span className="pill category">{LAYER_LABEL[item.layer]}</span>
          {item.status === "bounced" ? (
            <span className="pill status-flag tight" title="The routing contact hard-bounced">
              <Icons.AlertTriangle size={9} /> Bounced
            </span>
          ) : needs ? (
            <span className="pill attention tight">
              <span className="dot" />
              Needs contact
            </span>
          ) : (
            <span className="pill status-ok tight">
              <Icons.Check size={9} /> Routed
            </span>
          )}
          {item.flaggedAt && (
            <span className="pill attention tight">
              <Icons.Flag size={9} /> Flagged
            </span>
          )}
          <span className="ident">{item.geoid}</span>
        </div>
        <div className="sub">
          <span className="strong">{fmtPop(item.population)} pop</span>
          <span className="sep">·</span>
          <span>{item.reportsWaiting} waiting</span>
          <span className="sep">·</span>
          <span>{item.coverage}</span>
        </div>
      </div>
      <div className="trailing">
        <span className="age">{fmtRouted(item.lastRouted)}</span>
        <span className="row-arrow">
          <Icons.ChevronRight size={14} />
        </span>
      </div>
    </div>
  )
}

function JurisdictionDetail({ dto }: { dto: JurisdictionDirectoryDTO }) {
  const toast = useToast()
  const patch = usePatchJurisdiction()
  const saveContacts = useSaveJurisdictionContacts()
  const geometry = useJurisdictionGeometry(dto.geoid)

  const [contacts, setContacts] = React.useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {}
    dto.contacts.forEach((c: DiscoveryContact) => {
      if (c.email) seed[c.category] = c.email
    })
    return seed
  })
  const [opNote, setOpNote] = React.useState("")
  const [defaultEmail, setDefaultEmail] = React.useState(dto.email ?? "")
  const [formUrl, setFormUrl] = React.useState(dto.form ?? "")
  const [handle, setHandle] = React.useState(dto.handle ?? "")

  const counts = dto.perCategoryCounts
  const setCat = (id: string, email: string) => setContacts((prev) => ({ ...prev, [id]: email }))
  const hasDefault = defaultEmail.trim() !== ""
  const missingContacts = REPORT_TYPES.filter(
    (c) => routingCount(counts, c.id) > 0 && !contacts[c.id] && !hasDefault,
  ).length
  const filledCount = REPORT_TYPES.filter((c) => contacts[c.id]).length
  const canSave = filledCount > 0 || hasDefault
  const needs = needsAttention(dto)
  const dom = dominantCategory(counts)
  const headPin = dom ? catPinSrc(dom) : null
  const isFlagged = dto.flaggedAt !== null
  const busy = saveContacts.isPending || patch.isPending

  const contactsPayload = (): Partial<Record<ReportCategory, string | null>> => {
    const out: Partial<Record<ReportCategory, string | null>> = {}
    REPORT_TYPES.forEach((c) => {
      const v = contacts[c.id]?.trim()
      if (v) out[c.id] = v
    })
    return out
  }

  const jurisdictionFields = (): { defaultEmails?: string[]; formUrl?: string | null } => {
    const out: { defaultEmails?: string[]; formUrl?: string | null } = {}
    const email = defaultEmail.trim()
    if (email) out.defaultEmails = [email]
    const url = formUrl.trim()
    if (url) out.formUrl = url
    return out
  }

  const onFlag = async () => {
    if (!isFlagged) {
      const reason = await promptDialog({ title: "Flag jurisdiction", label: "Reason (optional)" })
      if (reason === null) return
      patch.mutate(
        { geoid: dto.geoid, flagged: true, flagReason: reason || undefined },
        { onSuccess: () => toast(`${dto.org} flagged for review`) },
      )
      return
    }
    patch.mutate(
      { geoid: dto.geoid, flagged: false },
      { onSuccess: () => toast(`Flag cleared for ${dto.org}`) },
    )
  }

  const onSaveDraft = () => {
    const note = opNote.trim()
    const contacts = contactsPayload()
    const jf = jurisdictionFields()
    const normalizedHandle = handle.trim().replace(/^@+/, "").toLowerCase()
    const handleChanged = normalizedHandle !== (dto.handle ?? "")
    if (
      Object.keys(contacts).length === 0 &&
      Object.keys(jf).length === 0 &&
      note === "" &&
      !handleChanged
    ) {
      toast("Nothing to save yet")
      return
    }
    patch.mutate(
      {
        geoid: dto.geoid,
        contacts,
        ...jf,
        ...(note ? { notes: note } : {}),
        ...(handleChanged ? { handle: normalizedHandle } : {}),
      },
      {
        onSuccess: () => toast(`Draft saved for ${dto.org}`),
        onError: (err) => toast(toAppError(err).message),
      },
    )
  }

  const onSaveAndRoute = () => {
    if (!canSave) return
    saveContacts.mutate(
      { geoid: dto.geoid, contacts: contactsPayload(), ...jurisdictionFields() },
      { onSuccess: () => toast(`Contacts saved for ${dto.org}. Outreach queued.`) },
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
            {LAYER_LABEL[dto.layer]} · Jurisdiction · GEOID {dto.geoid}
          </div>
          <h2>{dto.org}</h2>
        </div>
        {dto.status === "bounced" ? (
          <span
            className="pill status-flag"
            style={{ marginLeft: "auto" }}
            title="The routing contact hard-bounced — re-enter a contact to clear it"
          >
            <Icons.AlertTriangle size={11} /> Bounced
          </span>
        ) : needs ? (
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
          { }
          <div className="sub">
            <div className="sub-head">Jurisdiction</div>
            <div className="sub-body" style={{ padding: 10 }}>
              <div className="mini-map" style={geometry.data ? { height: 220 } : undefined}>
                {geometry.data ? (
                  <BoundaryMap
                    geometry={geometry.data.geometry}
                    bbox={geometry.data.bbox}
                    layer={geometry.data.layer}
                  />
                ) : (
                  <div className="juris-label">
                    {geometry.isLoading ? "Loading boundary…" : dto.org}
                  </div>
                )}
              </div>
              <div className="juris-stats">
                <div>
                  <div className="eyebrow">Population</div>
                  <div className="juris-stat-n">{dto.population.toLocaleString()}</div>
                  <div className="juris-stat-sub">
                    {dto.population > 0 ? "US Census ACS" : "Not available"}
                  </div>
                </div>
                <div>
                  <div className="eyebrow">Reports waiting</div>
                  <div className="juris-stat-n">{dto.reportsWaiting}</div>
                  <div className="juris-stat-sub">{LAYER_LABEL[dto.layer]}</div>
                </div>
              </div>
            </div>
          </div>

          { }
          <div className="sub">
            <div className="sub-head">Notes &amp; history</div>
            <div className="sub-body">
              <div className="field" style={{ marginTop: 0, marginBottom: 0 }}>
                <textarea
                  placeholder="Add a note for the next operator…"
                  value={opNote}
                  onChange={(e) => setOpNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rep-col">
          { }
          <div className="sub">
            <div className="sub-head">Discussion @handle</div>
            <div className="sub-body">
              <div className="ccat-email">
                <span aria-hidden="true" style={{ fontWeight: 700, color: "var(--ink-3)" }}>
                  @
                </span>
                <input
                  type="text"
                  value={handle}
                  placeholder="sf — tag this jurisdiction in a report discussion"
                  onChange={(e) => setHandle(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Jurisdiction discussion handle"
                />
              </div>
              <div className="hint" style={{ marginTop: 8 }}>
                Residents can tag “@
                {handle.trim().replace(/^@+/, "").toLowerCase() || "handle"}” in a report’s discussion to
                forward it to this jurisdiction. Lowercase letters, numbers, and underscores; leave blank to
                clear. Saved with “Save draft”.
              </div>
            </div>
          </div>

          { }
          <div className="sub">
            <div className="sub-head">Default contact</div>
            <div className="sub-body">
              <div className="ccat-email">
                <Icons.Mail size={13} />
                <input
                  type="email"
                  value={defaultEmail}
                  placeholder="e.g. reports@city.gov"
                  onChange={(e) => setDefaultEmail(e.target.value)}
                />
              </div>
              <div className="ccat-email" style={{ marginTop: 8 }}>
                <Icons.Building size={13} />
                <input
                  type="url"
                  value={formUrl}
                  placeholder="e.g. https://city.gov/report"
                  onChange={(e) => setFormUrl(e.target.value)}
                />
              </div>
              <div className="hint" style={{ marginTop: 8 }}>
                The default email routes any category without its own contact below; the form URL is the
                city’s public reporting page.
              </div>
            </div>
          </div>

          { }
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
                  const n = routingCount(counts, c.id)
                  const attention = n > 0 && !contacts[c.id] && !hasDefault
                  const pin = c.pin
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
                              ? "Add a contact — reports waiting"
                              : "e.g. publicworks@city.gov"
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
                Counts are reports waiting per type · highlighted types have reports but no contact yet.
              </div>
            </div>
          </div>
        </div>
      </div>

      { }
      <div className="rep-actions">
        <span className="rep-actions-label">
          {filledCount} of {REPORT_TYPES.length} contacts set
        </span>
        <div className="spacer" />
        <button className="btn danger" disabled={patch.isPending} onClick={onFlag}>
          <Icons.Flag size={13} /> {isFlagged ? "Clear flag" : "Flag for review"}
        </button>
        <button className="btn" disabled={busy} onClick={onSaveDraft}>
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

function UnmappedDetail({ dto }: { dto: JurisdictionDirectoryDTO }) {
  const counts = dto.perCategoryCounts
  const waiting = REPORT_TYPES.filter((c) => routingCount(counts, c.id) > 0)
  return (
    <div className="rep-detail">
      <div className="rep-head">
        <span className="rep-head-pin">
          <Icons.AlertTriangle size={22} />
        </span>
        <div className="rep-head-text">
          <div className="crumb">Triage · location did not resolve</div>
          <h2>{dto.org}</h2>
        </div>
        <span className="pill attention" style={{ marginLeft: "auto" }}>
          <span className="dot" />
          {dto.reportsWaiting} waiting
        </span>
      </div>

      <div className="sub">
        <div className="sub-head">What this is</div>
        <div className="sub-body">
          <p className="rep-desc">
            These reports’ locations didn’t resolve to any jurisdiction on file, so they can’t be routed to
            a city contact yet. This usually means jurisdiction boundaries haven’t been loaded (run the
            jurisdictions seed/ingest), or the pins fall outside all known coverage.
          </p>
        </div>
      </div>

      <div className="sub">
        <div className="sub-head">Waiting reports by type</div>
        <div className="sub-body">
          {waiting.length === 0 ? (
            <div className="hint">Nothing waiting.</div>
          ) : (
            <div className="ccat-grid one-col">
              {waiting.map((c) => {
                const n = routingCount(counts, c.id)
                return (
                  <div key={c.id} className="ccat-cell">
                    <div className="ccat-cell-head">
                      {c.pin ? (
                        <span className="ccat-pin">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.pin} alt="" />
                        </span>
                      ) : (
                        <span className="ccat-other">
                          <Icons.Layers size={13} />
                        </span>
                      )}
                      <span className="ccat-label">{c.label}</span>
                      <span className="ccat-count">
                        {n} {n === 1 ? "report" : "reports"}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="hint" style={{ marginTop: 10 }}>
            Once jurisdictions are loaded, new pins route automatically; existing unmapped pins may need a
            re-resolve pass.
          </div>
        </div>
      </div>
    </div>
  )
}

export function DiscoveryPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<"all" | "attention" | "clear">("all")
  const [layer, setLayer] = React.useState<"all" | JurisdictionLayer>("all")
  const [sort, setSort] = React.useState<"pop" | "reports">("pop")
  const [query, setQuery] = React.useState(focusId ?? "")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const [debouncedQ, setDebouncedQ] = React.useState("")
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  const serverFilter = filter === "attention" ? "none" : filter === "clear" ? "routed" : "all"
  const serverSort = sort === "reports" ? "reports" : "population"
  const listQuery = useJurisdictionDirectory({
    filter: serverFilter,
    sort: serverSort,
    ...(layer !== "all" ? { layer } : {}),
    ...(debouncedQ ? { q: debouncedQ } : {}),
  })

  const items = React.useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  )
  const total = listQuery.data?.pages[0]?.total ?? null
  const facets = listQuery.data?.pages[0]?.facets ?? null

  React.useEffect(() => {
    if (focusId) {
      setSelId(focusId)
      setQuery(focusId)
    }
  }, [focusId])

  const selected =
    (selId ? (items.find((x) => x.geoid === selId) ?? null) : null) ?? items[0] ?? null

  const catFilters = [
    { value: "all", label: "All", count: total ?? 0 },
    { value: "attention", label: "Needs contact", count: facets?.unrouted ?? 0 },
    { value: "clear", label: "Routed", count: facets?.routed ?? 0 },
  ]
  const headerCount =
    filter === "attention" ? facets?.unrouted : filter === "clear" ? facets?.routed : total

  return (
    <>
      <PageHead
        title="Jurisdictions"
        subtitle={
          <span>
            Every place reports land in, and who they route to. Map a routing contact for the ones that
            need one, and reports start flowing.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={catFilters}
          value={filter}
          onChange={(v) => setFilter(v as "all" | "attention" | "clear")}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            placeholder="Search place or GEOID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="sortbox">
          <span className="sortbox-label">Type</span>
          <select
            value={layer}
            onChange={(e) => setLayer(e.target.value as "all" | JurisdictionLayer)}
            aria-label="Filter by jurisdiction type"
          >
            <option value="all">All types</option>
            <option value="state">States</option>
            <option value="county">Counties</option>
            <option value="place">Cities</option>
            <option value="federal">Federal land</option>
            <option value="tribal">Tribal</option>
          </select>
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
              {(headerCount ?? items.length).toLocaleString()}{" "}
              {(headerCount ?? items.length) === 1 ? "jurisdiction" : "jurisdictions"}
            </h3>
            <div className="spacer" />
            <span className="meta">click a row →</span>
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading jurisdictions…" />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                title="Nothing matches"
                sub="Try a different filter or search."
                icon={<Icons.Search size={20} />}
              />
            ) : (
              <>
                {items.map((item) => (
                  <JurisdictionRow
                    key={item.geoid}
                    item={item}
                    selected={selected?.geoid === item.geoid}
                    onClick={() => setSelId(item.geoid)}
                  />
                ))}
                {listQuery.hasNextPage && (
                  <button
                    type="button"
                    className="btn"
                    style={{ width: "calc(100% - 20px)", margin: "8px 10px" }}
                    disabled={listQuery.isFetchingNextPage}
                    onClick={() => listQuery.fetchNextPage()}
                  >
                    {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selected ? (
            selected.geoid === UNMAPPED_GEOID ? (
              <UnmappedDetail key={selected.geoid} dto={selected} />
            ) : (
              <JurisdictionDetail key={selected.geoid} dto={selected} />
            )
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

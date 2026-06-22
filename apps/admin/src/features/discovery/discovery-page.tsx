"use client"

import * as React from "react"
import {
  type DiscoveryContact,
  type JurisdictionDirectoryDTO,
  type JurisdictionLayer,
  type PerCategoryCounts,
  type ReportCategory,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { toAppError } from "@/lib/api"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import {
  useJurisdictionDirectory,
  usePatchJurisdiction,
  useSaveJurisdictionContacts,
} from "@/features/discovery/use-discovery"
import { useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Jurisdictions (the section the design titles "Jurisdictions"; ported from pages-discovery.jsx,
 * enumeration 2.B). Master-detail: a persistent list of EVERY jurisdiction reports map to on the left
 * (filter chips All / Need attention / No action required, search, sort) and the per-jurisdiction
 * contact-research panel on the right.
 *
 * DATA SOURCE (re-sourced): the list comes from GET /admin/jurisdictions (the full directory) rather
 * than the discovery-task queue, so a jurisdiction STAYS listed after it is routed (the queue dropped
 * routed tasks) and jurisdictions seeded with contacts also appear. Each row carries its TYPE
 * (City / County / State / Federal land / Tribal), waiting-report counts, and existing contacts, so the
 * detail renders straight from the selected row (no second fetch). The right panel writes a per-category
 * routing contact for the GEOID ("Save & route"), saves a draft (PATCH, no routing), and flags for
 * review (PATCH flagged) - all via the typed admin client.
 *
 * PARITY: faithful to the design's DOM/classes (.qrow, .pill, .sub, .ccat-grid, master-detail). The
 * directory DTO carries no mini-map geometry or persisted operator notes, so the Jurisdiction card shows
 * the design's text-label map fallback and the Notes textarea is local-only (non-persisting), as the
 * prototype's note field already was. A jurisdiction TYPE chip (.pill.category) is added to each row +
 * the detail crumb. See .parity/ for the recorded divergence.
 */

/** Human label for the jurisdiction TYPE chip (the design groups jurisdictions by this). */
const LAYER_LABEL: Record<JurisdictionLayer, string> = {
  place: "City",
  county: "County",
  state: "State",
  federal: "Federal land",
  tribal: "Tribal",
}

/**
 * Sentinel geoid for the synthetic "Unmapped / Unknown jurisdiction" row (mirrors the backend
 * UNMAPPED_GEOID in jurisdiction-contacts-service.ts). It aggregates waiting reports whose location did
 * not resolve to a known jurisdiction. It is NOT a real jurisdiction — Save & route / PATCH would 404 —
 * so the row + detail render read-only triage (waiting backlog only, no routing controls).
 */
const UNMAPPED_GEOID = "__unmapped__"

/** Format an ISO timestamp as a short "Mon D" label (the DTO ships lastRouted as a raw ISO string). */
function fmtRouted(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/**
 * The routing grid's category id. The design's `window.CATEGORIES` carries a 7th routing type,
 * `cleanup`, that shared's `ReportCategorySchema` deliberately excludes (cleanups are a separate
 * entity). We model the grid locally with this superset and map back to `ReportCategory` at the save
 * boundary (`contactsPayload`). See PARITY note below.
 */
type DiscoveryRoutingCategory = ReportCategory | "cleanup"

/**
 * The 6 civfix report categories + the design-only `cleanup` row + a synthetic "Other" row, in the
 * exact order the design's routing grid renders: Trash, Recycling, Graffiti, Hazard, Cleanup, Water,
 * Other. `pin` is the leading pin asset (`/ds/pin-<id>.svg`); the "other" row has no pin.
 *
 * PARITY: `cleanup` is rendered for visual parity only - the admin contacts endpoints type `contacts`
 * as `Record<ReportCategory, ...>`, which cannot carry a `cleanup` key, so a Cleanup contact is dropped
 * at the save boundary (input stays save-safe). Its waiting count comes from `perCategoryCounts`, which
 * is also `ReportCategory`-keyed, so it has no `cleanup` entry -> defaults to 0.
 */
const REPORT_TYPES: { id: DiscoveryRoutingCategory; label: string; pin: string | null }[] = [
  { id: "trash", label: "Trash", pin: "/ds/pin-trash.svg" },
  { id: "recycling", label: "Recycling", pin: "/ds/pin-recycling.svg" },
  { id: "graffiti", label: "Graffiti", pin: "/ds/pin-graffiti.svg" },
  { id: "hazard", label: "Hazard", pin: "/ds/pin-hazard.svg" },
  { id: "cleanup", label: "Cleanup", pin: "/ds/pin-cleanup.svg" },
  { id: "water", label: "Water", pin: "/ds/pin-water.svg" },
  { id: "other", label: "Other", pin: null },
]

/** The 6 civfix report categories in canonical order (for the dominant-pin pick). */
const CATEGORIES: readonly ReportCategory[] = [
  "trash",
  "recycling",
  "graffiti",
  "hazard",
  "water",
  "other",
]

/** Waiting-report count for a routing-grid category. `cleanup` is never in the map -> 0. */
function routingCount(counts: PerCategoryCounts, id: DiscoveryRoutingCategory): number {
  if (id === "cleanup") return 0
  return counts[id] ?? 0
}

/** Pin asset for a category. "other" has no pin (rendered as a Layers glyph by the caller). */
function catPinSrc(category: ReportCategory): string | null {
  if (category === "other") return null
  return `/ds/pin-${category}.svg`
}

/** The dominant waiting category (drives the leading row pin); null when nothing is waiting. */
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

/** A jurisdiction needs attention when it has waiting reports and no routing contact on file at all. */
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

  // The synthetic "Unmapped" row: waiting reports whose location did not resolve to a jurisdiction. Render
  // a distinct, contact-free triage row (no type chip / GEOID / population — none apply).
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
            // A hard-bounced contact takes precedence over the routed/needs-contact posture: the address
            // on file is dead and the jurisdiction needs a fresh contact.
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

  // Per-category contact emails (controlled inputs), seeded once from the row's stored contacts. The
  // parent keys this component by geoid, so it remounts (and re-seeds) when the selection changes.
  const [contacts, setContacts] = React.useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {}
    dto.contacts.forEach((c: DiscoveryContact) => {
      if (c.email) seed[c.category] = c.email
    })
    return seed
  })
  // Operator-note textarea state. Local-only (the directory carries no persisted notes; the design's
  // Notes card textarea was non-persisting too). See PARITY.
  const [opNote, setOpNote] = React.useState("")
  // The jurisdiction-level default email (the fallback/all-categories address) and reporting-form URL,
  // seeded from the row. Persisted via the contract's SaveContactsRequest.defaultEmails + formUrl.
  const [defaultEmail, setDefaultEmail] = React.useState(dto.email ?? "")
  const [formUrl, setFormUrl] = React.useState(dto.form ?? "")
  // The discussion @handle (the "@sf" mentionable in a report discussion). Seeded from the row; persisted
  // via PATCH handle on "Save draft". Stored bare (no leading "@"); the input shows the "@" as a prefix.
  const [handle, setHandle] = React.useState(dto.handle ?? "")

  const counts = dto.perCategoryCounts
  const setCat = (id: string, email: string) => setContacts((prev) => ({ ...prev, [id]: email }))
  const slug = dto.org.split(",")[0]?.toLowerCase().replace(/\s+/g, "-") ?? "city"
  const missingContacts = REPORT_TYPES.filter(
    (c) => routingCount(counts, c.id) > 0 && !contacts[c.id],
  ).length
  const filledCount = REPORT_TYPES.filter((c) => contacts[c.id]).length
  // Routable when there's at least one per-category contact OR a jurisdiction-level default email (the
  // fallback address every category falls back to).
  const canSave = filledCount > 0 || defaultEmail.trim() !== ""
  const needs = needsAttention(dto)
  const dom = dominantCategory(counts)
  const headPin = dom ? catPinSrc(dom) : null
  const isFlagged = dto.flaggedAt !== null
  const busy = saveContacts.isPending || patch.isPending

  // Build the per-category contact map for a write (only non-empty emails). The design-only `cleanup`
  // row is skipped: it is not a `ReportCategory`, so the contract's `Record<ReportCategory, ...>` cannot
  // carry it. Skipping it keeps the input save-safe instead of crashing.
  const contactsPayload = (): Partial<Record<ReportCategory, string | null>> => {
    const out: Partial<Record<ReportCategory, string | null>> = {}
    REPORT_TYPES.forEach((c) => {
      if (c.id === "cleanup") return
      const v = contacts[c.id]?.trim()
      if (v) out[c.id] = v
    })
    return out
  }

  // The jurisdiction-level default email + reporting-form URL, shaped for the contract: `defaultEmails`
  // is the fallback/all-categories address list (a single entry here); `formUrl` is the city's form URL
  // (null to clear). Only included when set, so an untouched field doesn't overwrite server state.
  const jurisdictionFields = (): { defaultEmails?: string[]; formUrl?: string | null } => {
    const out: { defaultEmails?: string[]; formUrl?: string | null } = {}
    const email = defaultEmail.trim()
    if (email) out.defaultEmails = [email]
    const url = formUrl.trim()
    if (url) out.formUrl = url
    return out
  }

  const onFlag = () => {
    patch.mutate(
      { geoid: dto.geoid, flagged: !isFlagged },
      {
        onSuccess: () =>
          toast(isFlagged ? `Flag cleared for ${dto.org}` : `${dto.org} flagged for review`),
      },
    )
  }

  const onSaveDraft = () => {
    // Include the operator note in the PATCH so it persists server-side instead of being silently dropped
    // (the backend PATCH supports `notes`). Skip a no-op save when nothing changed.
    const note = opNote.trim()
    const contacts = contactsPayload()
    const jf = jurisdictionFields()
    // The handle, normalized to a bare lowercase slug (a leading "@" / casing is forgiven). Send it only
    // when it actually changed from the row's stored value; an empty string clears it (server -> NULL).
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
        // Surface a rejected handle (reserved / already taken / bad format) instead of failing silently.
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
          {/* Jurisdiction map + stats */}
          <div className="sub">
            <div className="sub-head">Jurisdiction</div>
            <div className="sub-body" style={{ padding: 10 }}>
              <div className="mini-map">
                <div className="juris-label">{dto.org}</div>
              </div>
              <div className="juris-stats">
                <div>
                  <div className="eyebrow">Population</div>
                  <div className="juris-stat-n">{dto.population.toLocaleString()}</div>
                  <div className="juris-stat-sub">TIGER 2024</div>
                </div>
                <div>
                  <div className="eyebrow">Reports waiting</div>
                  <div className="juris-stat-n">{dto.reportsWaiting}</div>
                  <div className="juris-stat-sub">{LAYER_LABEL[dto.layer]}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
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
          {/* Discussion @handle — the "@sf" residents tag in a report's discussion to forward it here.
              Stored bare (no leading "@"); saved via the detail's "Save draft" (PATCH handle). */}
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

          {/* Default contact + reporting form — the jurisdiction-level fallback used for any category
              without its own per-type contact, plus the city's public reporting-form URL. */}
          <div className="sub">
            <div className="sub-head">Default contact</div>
            <div className="sub-body">
              <div className="ccat-email">
                <Icons.Mail size={13} />
                <input
                  type="email"
                  value={defaultEmail}
                  placeholder="reports@city.gov — fallback for every category"
                  onChange={(e) => setDefaultEmail(e.target.value)}
                />
              </div>
              <div className="ccat-email" style={{ marginTop: 8 }}>
                <Icons.Building size={13} />
                <input
                  type="url"
                  value={formUrl}
                  placeholder="https://city.gov/report — reporting form URL (optional)"
                  onChange={(e) => setFormUrl(e.target.value)}
                />
              </div>
              <div className="hint" style={{ marginTop: 8 }}>
                The default email routes any category without its own contact below; the form URL is the
                city’s public reporting page.
              </div>
            </div>
          </div>

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
                  const n = routingCount(counts, c.id)
                  const attention = n > 0 && !contacts[c.id]
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
                            attention ? "Add a contact — reports waiting" : `${c.id}@${slug}.gov`
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

      {/* Action bar */}
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

/**
 * Read-only triage view for the synthetic "Unmapped / Unknown jurisdiction" row. It is NOT a real
 * jurisdiction (Save & route / PATCH would 404), so it shows only the waiting backlog + guidance, with no
 * contact/routing controls.
 */
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
  const [filter, setFilter] = React.useState("all")
  const [sort, setSort] = React.useState<"pop" | "reports">("pop")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  // The full directory. Search + the attention/clear facet + the pop/reports sort are applied
  // client-side (matching the design, which filtered its in-memory set). A generous page covers the
  // expected jurisdiction count; large deployments would move search/sort server-side (follow-up).
  const listQuery = useJurisdictionDirectory({ limit: 100 })
  const all = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data])
  const attentionCount = React.useMemo(() => all.filter(needsAttention).length, [all])

  const items = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    let xs = q
      ? all.filter((x) => x.org.toLowerCase().includes(q) || x.geoid.toLowerCase().includes(q))
      : all.slice()
    if (filter === "attention") xs = xs.filter(needsAttention)
    else if (filter === "clear") xs = xs.filter((x) => !needsAttention(x))
    xs.sort((a, b) =>
      sort === "reports" ? b.reportsWaiting - a.reportsWaiting : b.population - a.population,
    )
    return xs
  }, [all, query, filter, sort])

  // Keep a selection: honor focusId, else fall back to the first row of the current view.
  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.geoid)
    if (selId && items.length && !items.some((x) => x.geoid === selId)) {
      setSelId(items[0]!.geoid)
    }
  }, [items, selId])

  const selected = items.find((x) => x.geoid === selId) ?? null

  const catFilters = [
    { value: "all", label: "All", count: all.length },
    { value: "attention", label: "Need attention", count: attentionCount },
    { value: "clear", label: "No action required", count: all.length - attentionCount },
  ]

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
        <FilterChips options={catFilters} value={filter} onChange={setFilter} />
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
              items.map((item) => (
                <JurisdictionRow
                  key={item.geoid}
                  item={item}
                  selected={selId === item.geoid}
                  onClick={() => setSelId(item.geoid)}
                />
              ))
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

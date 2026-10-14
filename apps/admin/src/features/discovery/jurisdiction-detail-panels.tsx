"use client"

import dynamic from "next/dynamic"
import type { JurisdictionDirectoryDTO, PerCategoryCounts } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { useJurisdictionGeometry } from "@/features/discovery/use-discovery"
import {
  LAYER_LABEL,
  REPORT_TYPES,
  dominantCategory,
  routingCount,
} from "@/features/discovery/jurisdiction-view"
import { RoutingStatusPill } from "@/features/discovery/routing-status-pill"
import { categoryPinSrc } from "@/lib/category"

const BoundaryMap = dynamic(
  () => import("@/components/map/boundary-map").then((m) => m.BoundaryMap),
  { ssr: false },
)

export function JurisdictionHeader({ dto }: { dto: JurisdictionDirectoryDTO }) {
  const dominant = dominantCategory(dto.perCategoryCounts)
  const headPin = dominant ? categoryPinSrc(dominant) : null
  return (
    <div className="rep-head">
      <span className="rep-head-pin">
        {headPin ? (
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
      <RoutingStatusPill dto={dto} placement="head" />
    </div>
  )
}

export function BoundaryPanel({ dto }: { dto: JurisdictionDirectoryDTO }) {
  const geometry = useJurisdictionGeometry(dto.geoid)
  return (
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
            <div className="juris-label">{geometry.isLoading ? "Loading boundary…" : dto.org}</div>
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
  )
}

export function NotesPanel({ note, onChange }: { note: string; onChange: (note: string) => void }) {
  return (
    <div className="sub">
      <div className="sub-head">Notes &amp; history</div>
      <div className="sub-body">
        <div className="field" style={{ marginTop: 0, marginBottom: 0 }}>
          <textarea
            aria-label="Note for the next operator"
            placeholder="Add a note for the next operator…"
            value={note}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
          />
        </div>
      </div>
    </div>
  )
}

export function HandleField({
  handle,
  parsed,
  onChange,
}: {
  handle: string
  parsed: { value: string; error: string | null }
  onChange: (handle: string) => void
}) {
  return (
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
            placeholder="e.g. sf (tags this jurisdiction in a report discussion)"
            onChange={(e) => onChange(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Jurisdiction discussion handle"
          />
        </div>
        {parsed.error && (
          <span className="field-error" role="alert">
            <Icons.AlertTriangle size={11} /> {parsed.error}
          </span>
        )}
        <div className="hint" style={{ marginTop: 8 }}>
          Residents can tag “@{parsed.value || "handle"}” in a report’s discussion to forward
          it to this jurisdiction. Lowercase letters, numbers, and underscores; leave blank to clear.
          Saved by either “Save draft” or “Save &amp; route”.
        </div>
      </div>
    </div>
  )
}

export function DefaultContactFields({
  email,
  formUrl,
  onEmailChange,
  onFormUrlChange,
}: {
  email: string
  formUrl: string
  onEmailChange: (email: string) => void
  onFormUrlChange: (url: string) => void
}) {
  return (
    <div className="sub">
      <div className="sub-head">Default contact</div>
      <div className="sub-body">
        <div className="ccat-email">
          <Icons.Mail size={13} />
          <input
            type="email"
            aria-label="Default contact email"
            value={email}
            placeholder="e.g. reports@city.gov"
            onChange={(e) => onEmailChange(e.target.value)}
          />
        </div>
        <div className="ccat-email" style={{ marginTop: 8 }}>
          <Icons.Building size={13} />
          <input
            type="url"
            aria-label="Report form URL"
            value={formUrl}
            placeholder="e.g. https://city.gov/report"
            onChange={(e) => onFormUrlChange(e.target.value)}
          />
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          The default email routes any category without its own contact below; the form URL is the
          city’s public reporting page. Clearing the default email or form URL here does not remove
          the saved one.
        </div>
      </div>
    </div>
  )
}

export function CategoryContactsGrid({
  counts,
  contacts,
  hasDefault,
  missingCount,
  onChange,
}: {
  counts: PerCategoryCounts
  contacts: Record<string, string>
  hasDefault: boolean
  missingCount: number
  onChange: (category: string, email: string) => void
}) {
  return (
    <div className="sub">
      <div className="sub-head">
        Routing contacts
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>
          {missingCount > 0
            ? `${missingCount} type${missingCount === 1 ? "" : "s"} with no contact`
            : "all routed"}
        </span>
      </div>
      <div className="sub-body">
        <div className="ccat-grid one-col">
          {REPORT_TYPES.map((c) => {
            const n = routingCount(counts, c.id)
            const attention = n > 0 && !contacts[c.id] && !hasDefault
            return (
              <div
                key={c.id}
                className={`ccat-cell ${attention ? "attention" : ""} ${n === 0 ? "quiet" : ""}`}
              >
                <div className="ccat-cell-head">
                  <span className="ccat-pin">
                    <img src={c.pin} alt="" />
                  </span>
                  <span className="ccat-label">{c.label}</span>
                  <span className={`ccat-count ${n > 0 ? "" : "zero"} ${attention ? "warn" : ""}`}>
                    {n} {n === 1 ? "report" : "reports"}
                  </span>
                </div>
                {c.types && <div className="sub-caption">{c.types}</div>}
                <div className="ccat-email">
                  <Icons.Mail size={13} />
                  <input
                    type="email"
                    aria-label={`${c.label} contact email`}
                    value={contacts[c.id] ?? ""}
                    placeholder={
                      attention ? "Reports waiting: add a contact" : "e.g. publicworks@city.gov"
                    }
                    onChange={(e) => onChange(c.id, e.target.value)}
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
          Counts are reports waiting per category · the grey line lists the report types neighbors
          pick that fold into it · highlighted categories have reports but no contact yet.
        </div>
      </div>
    </div>
  )
}

export function TemplateSection({
  hasCustomTemplate,
  loading,
  onEdit,
}: {
  hasCustomTemplate: boolean
  loading: boolean
  onEdit: () => void
}) {
  return (
    <div className="sub">
      <div className="sub-head">Email template</div>
      <div className="sub-body">
        <div className="tpl-state">
          <span className="hint">
            {hasCustomTemplate ? "Custom template" : "Using the default template"}
          </span>
          <div className="spacer" />
          <button className="btn" disabled={loading} onClick={onEdit}>
            Edit template
          </button>
        </div>
      </div>
    </div>
  )
}

export function DetailActions({
  filledCount,
  canSave,
  saveBlocked,
  isFlagged,
  flagging,
  onFlag,
  onSaveDraft,
  onSaveAndRoute,
}: {
  filledCount: number
  canSave: boolean
  saveBlocked: boolean
  isFlagged: boolean
  flagging: boolean
  onFlag: () => void
  onSaveDraft: () => void
  onSaveAndRoute: () => void
}) {
  return (
    <>
      <div className="rep-actions">
        <span className="rep-actions-label">
          {filledCount} of {REPORT_TYPES.length} contacts set
        </span>
        <div className="spacer" />
        <button className="btn danger" disabled={flagging} onClick={onFlag}>
          <Icons.Flag size={13} /> {isFlagged ? "Clear flag" : "Flag for review"}
        </button>
        <button
          className="btn"
          disabled={saveBlocked}
          onClick={onSaveDraft}
          title="Saves the contacts, the note and the @handle without closing the discovery task"
        >
          Save draft
        </button>
        <button
          className={`btn ${canSave ? "success" : ""}`}
          disabled={!canSave || saveBlocked}
          onClick={onSaveAndRoute}
          title={
            canSave
              ? "Saves the contacts, the note and the @handle, closes the discovery task, and queues the outreach digest when outreach is enabled"
              : "Add at least one contact first"
          }
          style={!canSave ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
        >
          <Icons.Check size={13} /> Save &amp; route
        </button>
      </div>

      <div className="pay-note">
        <Icons.Send size={13} />
        <span>
          <b>Save &amp; route</b> saves the contacts, the note and the @handle, closes the discovery
          task, and queues an outreach digest to this jurisdiction when outreach digests are enabled. It
          does not email the reports already waiting; send each of those from its report.{" "}
          <b>Save draft</b> saves the same fields and leaves the discovery task open.
        </span>
      </div>
    </>
  )
}

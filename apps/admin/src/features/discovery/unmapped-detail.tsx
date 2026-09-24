"use client"

import type { JurisdictionDirectoryDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { REPORT_TYPES, routingCount } from "@/features/discovery/jurisdiction-view"

export function UnmappedDetail({ dto }: { dto: JurisdictionDirectoryDTO }) {
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
                      <span className="ccat-pin">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.pin} alt="" />
                      </span>
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

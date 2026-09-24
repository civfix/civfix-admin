"use client"

import type { AdminReportDTO } from "@civfix/shared"

import { toReporterProfileId } from "@/features/reports/reporter-navigation"
import { initials } from "@/lib/display"
import { useNav } from "@/store/ui-store"

export function ReporterCard({ reporter }: { reporter: AdminReportDTO["reporter"] }) {
  const nav = useNav()
  const reporterProfileId = toReporterProfileId(reporter.id)
  return (
    <div className="sub">
      <div className="sub-head">Reporter</div>
      <div className="sub-body">
        <div className="user-head">
          <span
            className="user-av"
            style={{ background: "linear-gradient(135deg, var(--sky), var(--moss))" }}
          >
            {initials(reporter.name)}
          </span>
          <div>
            <div className="user-name">{reporter.name}</div>
            <div className="user-handle mono">{reporter.handle}</div>
          </div>
        </div>
        <div className="user-meta-rows">
          <div className="umr">
            <span>Joined</span>
            <span className="mono">{reporter.joined}</span>
          </div>
        </div>
        {reporterProfileId && (
          <button className="btn sm ghost full" onClick={() => nav("users", reporterProfileId)}>
            View full account →
          </button>
        )}
      </div>
    </div>
  )
}

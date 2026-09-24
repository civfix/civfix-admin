"use client"

import * as React from "react"
import { REPORT_CATEGORY_LABELS, type AdminReportListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { categoryCssVar, categoryPinSrc } from "@/lib/category"
import { reportStatusView } from "@/lib/report-status"
import { toReporterProfileId } from "@/features/reports/reporter-navigation"
import { firstName } from "@/features/reports/person-name"
import { pluralize } from "@/features/reports/plural"
import { shortId } from "@/features/reports/report-id"
import { useNav } from "@/store/ui-store"

function ReportRowLeading({ item }: { item: AdminReportListItemDTO }) {
  const [brokenThumb, setBrokenThumb] = React.useState<string | null>(null)
  const thumb = item.thumbnailUrl !== brokenThumb ? item.thumbnailUrl : null
  const categoryLabel = REPORT_CATEGORY_LABELS[item.category]
  return (
    <div
      className={`leading ${thumb ? "has-thumb" : "has-pin"}`}
      style={{ ["--cat" as string]: categoryCssVar(item.category) }}
      role="img"
      aria-label={categoryLabel}
      title={categoryLabel}
    >
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBrokenThumb(thumb)}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={categoryPinSrc(item.category)} alt="" loading="lazy" decoding="async" />
      )}
    </div>
  )
}

function ReporterName({ reporter }: { reporter: AdminReportListItemDTO["reporter"] }) {
  const nav = useNav()
  const reporterId = toReporterProfileId(reporter.id)
  if (!reporterId) return <span>{firstName(reporter.name)}</span>
  return (
    <button
      type="button"
      className="lnk-inline"
      title={`Open ${reporter.name}'s profile`}
      onClick={(e) => {
        e.stopPropagation()
        nav("users", reporterId)
      }}
    >
      {firstName(reporter.name)}
    </button>
  )
}

export const ReportRow = React.memo(function ReportRow({
  item,
  selected,
  onSelect,
}: {
  item: AdminReportListItemDTO
  selected: boolean
  onSelect: (id: string) => void
}) {
  const view = reportStatusView(item.status)
  return (
    <div
      className={`qrow ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(item.id)}
      onKeyDown={(e) => {
        // A key pressed on the nested reporter link bubbles here; it must stay that link's activation.
        if (e.target !== e.currentTarget || !isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        onSelect(item.id)
      }}
    >
      <ReportRowLeading item={item} />
      <div className="body">
        <div className="top">
          <span className="title">{item.title}</span>
          {item.flagged && (
            <span className="rep-flag-dot" role="img" aria-label="Flagged" title="Flagged">
              <Icons.Flag size={10} />
            </span>
          )}
          <span className="ident" title={item.id}>
            {shortId(item.id)}
          </span>
        </div>
        <div className="sub">
          <span className="strong">{item.place}</span>
          <span className="sep">·</span>
          <ReporterName reporter={item.reporter} />
          {item.confirmations > 0 && (
            <>
              <span className="sep">·</span>
              <span>{pluralize(item.confirmations, "confirm")}</span>
            </>
          )}
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${view.cls} tight`}>{view.label}</span>
        <span className="age">{item.submitted.rel}</span>
      </div>
    </div>
  )
})

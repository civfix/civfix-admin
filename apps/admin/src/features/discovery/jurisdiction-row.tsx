"use client"

import type * as React from "react"
import type { JurisdictionDirectoryDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import {
  LAYER_LABEL,
  UNMAPPED_GEOID,
  dominantCategory,
  formatPopulation,
  formatRoutedDate,
  formatWaitingAge,
  isOverdue,
} from "@/features/discovery/jurisdiction-view"
import { RoutingStatusPill } from "@/features/discovery/routing-status-pill"
import { categoryPinSrc } from "@/lib/category"

function MappedLeading({ item }: { item: JurisdictionDirectoryDTO }) {
  const dominant = dominantCategory(item.perCategoryCounts)
  const pin = dominant ? categoryPinSrc(dominant) : null
  if (!pin) return <Icons.Layers size={16} />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={pin} alt="" />
}

function MappedBadges({ item }: { item: JurisdictionDirectoryDTO }) {
  return (
    <>
      <span className="pill category">{LAYER_LABEL[item.layer]}</span>
      <RoutingStatusPill dto={item} placement="row" />
      {item.flaggedAt && (
        <span className="pill attention tight">
          <Icons.Flag size={9} /> Flagged
        </span>
      )}
      <span className="ident">{item.geoid}</span>
    </>
  )
}

function MappedSub({ item }: { item: JurisdictionDirectoryDTO }) {
  return (
    <>
      <span className="strong">{formatPopulation(item.population)} pop</span>
      <span className="sep">·</span>
      <span>{item.reportsWaiting} waiting</span>
      <span className="sep">·</span>
      <span>{item.coverage}</span>
    </>
  )
}

function WaitingAge({ oldestReportAt }: { oldestReportAt: string | null }) {
  const overdue = isOverdue(oldestReportAt)
  return (
    <span
      className={`age juris-age ${overdue ? "overdue" : ""}`}
      title={oldestReportAt ? "Oldest waiting report" : "No waiting reports"}
    >
      {overdue && <Icons.AlertTriangle size={10} />}
      {formatWaitingAge(oldestReportAt)}
    </span>
  )
}

function RowAge({
  item,
  unmapped,
  showOldest,
}: {
  item: JurisdictionDirectoryDTO
  unmapped: boolean
  showOldest: boolean
}) {
  if (showOldest) {
    if (unmapped && !item.oldestReportAt) return null
    return <WaitingAge oldestReportAt={item.oldestReportAt} />
  }
  if (unmapped) return null
  return <span className="age">{formatRoutedDate(item.lastRouted)}</span>
}

export function JurisdictionRow({
  item,
  selected,
  onClick,
  showOldest = false,
}: {
  item: JurisdictionDirectoryDTO
  selected: boolean
  onClick: () => void
  showOldest?: boolean
}) {
  const unmapped = item.geoid === UNMAPPED_GEOID
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isKeyboardActivationKey(event.key)) return
    event.preventDefault()
    onClick()
  }

  return (
    <div
      className={`qrow ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <div className="leading has-pin" title={unmapped ? "Unmapped" : LAYER_LABEL[item.layer]}>
        {unmapped ? <Icons.AlertTriangle size={16} /> : <MappedLeading item={item} />}
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{item.org}</span>
          {unmapped ? (
            <span className="pill attention tight">
              <span className="dot" />
              Needs mapping
            </span>
          ) : (
            <MappedBadges item={item} />
          )}
        </div>
        <div className="sub">
          {unmapped ? (
            <>
              <span className="strong">{item.reportsWaiting} waiting</span>
              <span className="sep">·</span>
              <span>location didn’t resolve to a jurisdiction</span>
            </>
          ) : (
            <MappedSub item={item} />
          )}
        </div>
      </div>
      <div className="trailing">
        <RowAge item={item} unmapped={unmapped} showOldest={showOldest} />
        <span className="row-arrow">
          <Icons.ChevronRight size={14} />
        </span>
      </div>
    </div>
  )
}

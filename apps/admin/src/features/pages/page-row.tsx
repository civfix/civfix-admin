"use client"

import type { AdminEventPageListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { formatDateTime } from "@/lib/dates"
import { pageStatusView, VISIBILITY_LABEL } from "@/features/pages/page-labels"
import { publicPagePath } from "@/features/pages/page-path"

export function PageRow({
  item,
  selected,
  onClick,
}: {
  item: AdminEventPageListItemDTO
  selected: boolean
  onClick: () => void
}) {
  const view = pageStatusView(item.status)
  return (
    <div
      className={`qrow ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        onClick()
      }}
    >
      <div className="leading">
        <span className="evt-row-ico hue-lilac" title="Signup page">
          <Icons.Globe size={15} />
        </span>
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{item.title}</span>
          {item.flaggedAt && (
            <span className="rep-flag-dot" role="img" aria-label="Flagged" title="Flagged">
              <Icons.Flag size={10} />
            </span>
          )}
          <span className="ident">{item.slug ? publicPagePath(item.slug) : "no slug"}</span>
        </div>
        <div className="sub">
          <span className="strong">{VISIBILITY_LABEL[item.visibility]}</span>
          <span className="sep">·</span>
          <span>{item.viewCount.toLocaleString()} views</span>
          {item.orgName && (
            <>
              <span className="sep">·</span>
              <span>{item.orgName}</span>
            </>
          )}
          {item.organizer && (
            <>
              <span className="sep">·</span>
              <span>{item.organizer.name}</span>
            </>
          )}
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${view.cls} tight`}>{view.label}</span>
        <span className="age">{formatDateTime(item.publishedAt)}</span>
      </div>
    </div>
  )
}

"use client"

import type { AdminHostListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { formatDateTime } from "@/lib/dates"

export function HostRow({
  row,
  selected,
  onClick,
}: {
  row: AdminHostListItemDTO
  selected: boolean
  onClick: () => void
}) {
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
        <span className="evt-row-ico hue-bloom" title="Host">
          <Icons.Send size={15} />
        </span>
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{row.host.name}</span>
          <span className="ident">{row.host.handle}</span>
          {row.messagingSuspended && (
            <span className="pill status-flag tight">
              <Icons.Lock size={10} /> Suspended
            </span>
          )}
        </div>
        <div className="sub">
          <span className="strong">{row.broadcastCount.toLocaleString()} broadcasts</span>
          <span className="sep">·</span>
          <span>{row.recipientCount.toLocaleString()} recipients</span>
          <span className="sep">·</span>
          <span>
            {row.eventsMessaged.toLocaleString()}{" "}
            {row.eventsMessaged === 1 ? "event" : "events"}
          </span>
        </div>
      </div>
      <div className="trailing">
        {row.failedCount > 0 && (
          <span className="pill status-flag tight">{row.failedCount} failed</span>
        )}
        <span className="age">{formatDateTime(row.lastBroadcastAt)}</span>
      </div>
    </div>
  )
}

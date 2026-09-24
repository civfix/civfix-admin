"use client"

import type { AdminEventListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { eventStatusView } from "@/lib/event-status"
import { eventKindView } from "@/lib/event-kind"
import { shortId } from "@/features/events/event-id"
import { firstName } from "@/features/reports/person-name"
import { useNav } from "@/store/ui-store"

function OrganizerLink({ organizer }: { organizer: AdminEventListItemDTO["organizer"] }) {
  const nav = useNav()
  return (
    <button
      type="button"
      className="lnk-inline"
      title={`Open ${organizer.name}'s profile`}
      onClick={(e) => {
        e.stopPropagation()
        nav("users", organizer.id)
      }}
    >
      {firstName(organizer.name)}
    </button>
  )
}

export function EventRow({
  item,
  selected,
  onClick,
}: {
  item: AdminEventListItemDTO
  selected: boolean
  onClick: () => void
}) {
  const kindView = eventKindView(item.eventKind)
  const KindIcon = kindView.icon
  const statusPill = eventStatusView(item.status)
  return (
    <div
      className={`qrow ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        // A key pressed on the nested organizer link bubbles here; it must stay that link's activation.
        if (e.target !== e.currentTarget || !isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        onClick()
      }}
    >
      <div className="leading">
        <span
          className="evt-row-ico hue-sun"
          role="img"
          aria-label={kindView.label}
          title={kindView.label}
        >
          <KindIcon size={15} />
        </span>
      </div>
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
          <span>{item.attendees} attending</span>
          <span className="sep">·</span>
          <OrganizerLink organizer={item.organizer} />
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${statusPill.cls} tight`}>{statusPill.label}</span>
        <span className="age">{item.date.abs}</span>
      </div>
    </div>
  )
}

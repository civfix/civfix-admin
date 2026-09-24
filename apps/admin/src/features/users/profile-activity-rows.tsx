"use client"

import type { KeyboardEvent } from "react"
import {
  REPORT_CATEGORY_LABELS,
  type CleanupMemberRole,
  type UserEventItemDTO,
  type UserMessageItemDTO,
  type UserReportItemDTO,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { categoryPinSrc } from "@/lib/category"
import { reportStatusView } from "@/lib/report-status"
import { isMissing, type NavFn } from "@/features/users/user-display"
import { userMessageDestination } from "./profile-activity-navigation"

const SOURCE_LABEL: Record<NonNullable<UserMessageItemDTO["source"]>, string> = {
  chat: "Cleanup chat",
  group: "Group chat",
  dm: "Direct message",
  report: "Report comment",
}

const EVENT_ROLE_VIEW: Record<CleanupMemberRole, { verb: string; pill: string | null }> = {
  organizer: { verb: "Organized", pill: "Organizer" },
  cohost: { verb: "Co-hosted", pill: "Co-host" },
  coordinator: { verb: "Coordinated", pill: "Coordinator" },
  staff: { verb: "Staffed", pill: "Staff" },
  member: { verb: "Joined", pill: null },
}

function onActivationKey(open: () => void) {
  return (e: KeyboardEvent) => {
    if (!isKeyboardActivationKey(e.key)) return
    e.preventDefault()
    open()
  }
}

export function ProfileReportRow({ report, nav }: { report: UserReportItemDTO; nav: NavFn }) {
  const open = () => nav("reports", report.id)
  const status = reportStatusView(report.status)
  return (
    <div
      className="prow row-link"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onActivationKey(open)}
    >
      <span className="prow-pin" title={REPORT_CATEGORY_LABELS[report.category]}>
        <img src={categoryPinSrc(report.category)} alt="" />
      </span>
      <div className="prow-body">
        <div className="prow-title">{report.title}</div>
        <div className="prow-meta">
          {report.place} · <span className="mono">{report.id}</span>
        </div>
      </div>
      <span className={`pill ${status.cls} tight`}>{status.label}</span>
      <span className="prow-age">{report.age}</span>
    </div>
  )
}

export function ProfileEventRow({ event, nav }: { event: UserEventItemDTO; nav: NavFn }) {
  const role = EVENT_ROLE_VIEW[event.role] ?? EVENT_ROLE_VIEW.member
  const open = () => nav("events", event.id)
  return (
    <div
      className="prow row-link"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onActivationKey(open)}
    >
      <span className="prow-ico hue-moss">
        <Icons.Calendar size={14} />
      </span>
      <div className="prow-body">
        <div className="prow-title">
          {role.verb} the {event.title}
        </div>
        <div className="prow-meta">
          {!isMissing(event.place) && (
            <>
              {event.place}
              <span className="sep"> · </span>
            </>
          )}
          {event.attendees} {event.attendees === 1 ? "neighbor" : "neighbors"} joined
        </div>
      </div>
      {role.pill && <span className="pill status-progress tight">{role.pill}</span>}
      <span className="prow-age">{event.when}</span>
    </div>
  )
}

export function ProfileMessageRow({
  message,
  onRemove,
  removing,
  nav,
}: {
  message: UserMessageItemDTO
  onRemove: (message: UserMessageItemDTO) => void
  removing: boolean
  nav: NavFn
}) {
  const removed = !!message.deletedAt
  const source = message.source
  const destination = userMessageDestination(message)
  const open = destination ? () => nav(destination.page, destination.id) : undefined
  const content = (
    <>
      <span className="prow-ico hue-sky">
        {removed ? <Icons.Trash size={14} /> : <Icons.MessageSquare size={14} />}
      </span>
      <span className="prow-body">
        <span className="prow-title">
          {removed && <span className="pill status-flag tight">Removed</span>} {message.text}
        </span>
        <span className="prow-meta">
          {source && <span className="pill priority-low tight">{SOURCE_LABEL[source]}</span>} in{" "}
          {message.thread}
        </span>
      </span>
      <span className="prow-age">{message.when}</span>
    </>
  )
  return (
    <div className={`prow ${removed ? "removed" : ""}`}>
      {open ? (
        <button type="button" className="prow-main row-link" onClick={open}>
          {content}
        </button>
      ) : (
        <div className="prow-main">{content}</div>
      )}
      {!removed && (
        <button
          className="btn sm danger"
          disabled={removing}
          onClick={() => onRemove(message)}
          title="Remove this message (soft-delete; operators still see it as removed)"
        >
          <Icons.Trash size={11} /> Remove
        </button>
      )}
    </div>
  )
}

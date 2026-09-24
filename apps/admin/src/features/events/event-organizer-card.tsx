"use client"

import type { AdminEventDTO } from "@civfix/shared"

import { initials } from "@/features/reports/person-name"
import { useNav } from "@/store/ui-store"

// The server sends "-" when the organizer's join date is unknown.
const UNKNOWN_JOIN_DATE = "-"

export function EventOrganizerCard({ organizer }: { organizer: AdminEventDTO["organizer"] }) {
  const nav = useNav()
  return (
    <div className="sub">
      <div className="sub-head">Organizer</div>
      <div className="sub-body">
        <div className="user-head">
          <span
            className="user-av"
            style={{ background: "linear-gradient(135deg, var(--sun), var(--moss))" }}
          >
            {initials(organizer.name)}
          </span>
          <div>
            <div className="user-name">{organizer.name}</div>
            <div className="user-handle mono">{organizer.handle}</div>
          </div>
        </div>
        {organizer.joined !== UNKNOWN_JOIN_DATE && (
          <div className="user-meta-rows">
            <div className="umr">
              <span>Joined</span>
              <span className="mono">{organizer.joined}</span>
            </div>
          </div>
        )}
        <button className="btn sm ghost full" onClick={() => nav("users", organizer.id)}>
          View full account →
        </button>
      </div>
    </div>
  )
}

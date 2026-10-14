"use client"

import type { JurisdictionDirectoryDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { needsAttention } from "@/features/discovery/jurisdiction-view"

type PillPlacement = "row" | "head"

const PLACEMENT = {
  row: {
    tight: " tight",
    iconSize: 9,
    bouncedTitle: "The routing contact hard-bounced",
    style: undefined,
  },
  head: {
    tight: "",
    iconSize: 11,
    bouncedTitle: "The routing contact hard-bounced. Re-enter a contact to clear it.",
    style: { marginLeft: "auto" },
  },
} as const

export function RoutingStatusPill({
  dto,
  placement,
}: {
  dto: JurisdictionDirectoryDTO
  placement: PillPlacement
}) {
  const { tight, iconSize, bouncedTitle, style } = PLACEMENT[placement]
  if (dto.status === "bounced") {
    return (
      <span className={`pill status-flag${tight}`} style={style} title={bouncedTitle}>
        <Icons.AlertTriangle size={iconSize} /> Bounced
      </span>
    )
  }
  if (needsAttention(dto)) {
    return (
      <span className={`pill attention${tight}`} style={style}>
        <span className="dot" />
        Needs contact
      </span>
    )
  }
  return (
    <span className={`pill status-ok${tight}`} style={style}>
      <Icons.Check size={iconSize} /> Routed
    </span>
  )
}

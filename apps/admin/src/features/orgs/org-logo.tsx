"use client"

import type * as React from "react"
import { monogram, type AdminOrgDTO } from "@civfix/shared"

export const ORG_LOGO_ROW_SIZE = 32
export const ORG_LOGO_HEADER_SIZE = 36
const MONOGRAM_FONT_RATIO = 0.42

export function OrgLogo({
  org,
  size = ORG_LOGO_ROW_SIZE,
}: {
  org: Pick<AdminOrgDTO, "name" | "logoUrl">
  size?: number
}) {
  const style: React.CSSProperties = { width: size, height: size }
  if (org.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="org-logo" style={style} src={org.logoUrl} alt="" />
  }
  return (
    <span className="org-logo hue-sky" style={{ ...style, fontSize: Math.round(size * MONOGRAM_FONT_RATIO) }}>
      {monogram(org.name)}
    </span>
  )
}

"use client"

import type * as React from "react"
import type { AdminOrgDTO, OrgVerificationKind } from "@civfix/shared"

import { formatDateTime } from "@/lib/dates"
import { EMPTY_VALUE } from "@/lib/empty-value"
import { isHttpsUrl } from "@/lib/external-url"
import { orgStatusView } from "@/lib/org-status"
import { ORG_KIND_LABEL } from "@/features/orgs/org-verification"

export function Fact({
  label,
  mono,
  children,
}: {
  label: string
  mono?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="umr">
      <span>{label}</span>
      <span className={mono ? "mono" : undefined}>{children}</span>
    </div>
  )
}

/** Only an https url becomes a link; anything else stored is shown as text so it is never hidden. */
export function UrlFact({ url }: { url: string | null | undefined }) {
  if (isHttpsUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer noopener">
        {url}
      </a>
    )
  }
  return <>{url || EMPTY_VALUE}</>
}

export function kindLabel(kind: OrgVerificationKind | null | undefined): string {
  return kind ? ORG_KIND_LABEL[kind] : EMPTY_VALUE
}

export function DeletedFact({ deletedAt }: { deletedAt: string | null | undefined }) {
  if (!deletedAt) return null
  return <Fact label="Deleted">{formatDateTime(deletedAt)}</Fact>
}

export function OrgStatusSubHead({ title, org }: { title: string; org: Pick<AdminOrgDTO, "verifiedStatus"> }) {
  const statusView = orgStatusView(org.verifiedStatus)
  return (
    <div className="sub-head">
      {title}
      <span className={`pill ${statusView.cls} tight`} style={{ marginLeft: "auto" }}>
        {statusView.label}
      </span>
    </div>
  )
}

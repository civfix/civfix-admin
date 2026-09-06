"use client"

import * as React from "react"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { EmptyState } from "@/components/shared/page-primitives"
import { formatDateTime } from "@/lib/dates"
import { evidenceUrlRemainingMs, isEvidenceUrlExpired } from "@/features/orgs/evidence-cache"
import { useOrgVerificationDocument } from "@/features/orgs/use-orgs"

function shortMediaId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8)
}

function EvidenceViewer({ mediaId }: { mediaId: string }) {
  const q = useOrgVerificationDocument(mediaId)
  const expiresAt = q.data?.expiresAt ?? null
  const [expired, setExpired] = React.useState(false)

  React.useEffect(() => {
    if (expiresAt === null) {
      setExpired(false)
      return
    }
    const remaining = evidenceUrlRemainingMs(expiresAt)
    setExpired(isEvidenceUrlExpired(expiresAt))
    if (remaining <= 0) return
    const timer = setTimeout(() => setExpired(true), remaining)
    return () => clearTimeout(timer)
  }, [expiresAt])

  if (q.isLoading) return <LoadingState label="Loading document..." />
  if (q.isError) {
    return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not open evidence" />
  }
  if (!q.data) return null
  const media = q.data.media
  if (media.status !== "ready") {
    return (
      <div className="org-evidence-note">
        This document is <b>{media.status}</b> and cannot be opened yet.
      </div>
    )
  }
  if (expired) {
    return (
      <div className="org-evidence-view">
        <span className="org-evidence-note">
          The signed link expired at {formatDateTime(q.data.expiresAt)}. Request a fresh one; the new
          read is audited too.
        </span>
        <button type="button" className="btn sm" onClick={() => void q.refetch()}>
          <Icons.Clock size={12} /> Request a new link
        </button>
      </div>
    )
  }
  return (
    <div className="org-evidence-view">
      {media.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="org-evidence-img" src={media.url} alt="" />
      ) : null}
      <a className="btn sm" href={media.url} target="_blank" rel="noreferrer noopener">
        <Icons.ExternalLink size={12} /> Open document
      </a>
      <span className="org-evidence-note">
        Opening this document is recorded against your operator account as a media.viewed audit
        entry. The link is signed for this read only and stops working at{" "}
        {formatDateTime(q.data.expiresAt)}. Do not forward it.
      </span>
    </div>
  )
}

export function EvidenceList({ mediaIds }: { mediaIds: string[] }) {
  const [openId, setOpenId] = React.useState<string | null>(null)

  const mediaKey = mediaIds.join(",")
  React.useEffect(() => {
    setOpenId(null)
  }, [mediaKey])

  if (mediaIds.length === 0) {
    return (
      <EmptyState
        title="No evidence uploaded"
        sub="The applicant submitted this verification without supporting documents."
        icon={<Icons.FileText size={20} />}
      />
    )
  }

  return (
    <div className="org-evidence-list">
      {mediaIds.map((mediaId, index) => {
        const open = openId === mediaId
        return (
          <div key={mediaId} className={`org-evidence-row ${open ? "open" : ""}`}>
            <button
              type="button"
              className="org-evidence-head"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : mediaId)}
            >
              <span className="org-evidence-ico">
                <Icons.FileText size={14} />
              </span>
              <span className="org-evidence-title">Document {index + 1}</span>
              <span className="ident mono">{shortMediaId(mediaId)}</span>
              <Icons.ChevronDown size={13} />
            </button>
            {open && <EvidenceViewer mediaId={mediaId} />}
          </div>
        )
      })}
    </div>
  )
}

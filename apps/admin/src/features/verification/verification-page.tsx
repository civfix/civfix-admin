"use client"

import * as React from "react"
import {
  type AdminVerificationDTO,
  type VerificationDocument,
  type VerificationStatus,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import {
  useApproveVerification,
  useRejectVerification,
  useVerification,
  useVerificationDocumentUrl,
  useVerifications,
} from "@/features/verification/use-verification"
import { errorMessage } from "@/lib/error-messages"
import { useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Verification queue (document "verified neighbor" review). Master-detail mirroring the Users /
 * Jurisdictions pages: the application list on the left (filter chips Pending / Verified / Rejected / All
 * + search name/handle) and the selected application on the right — the applicant, their note to the
 * reviewer, the uploaded document thumbnails (each fetched via the admin signed-URL route), the status,
 * and an action bar that approves or rejects (Reject reveals an inline reason textarea before
 * confirming). Everything is wired to the typed admin client.
 *
 * Document images are served only by the authenticated admin signed-URL route (never the public media
 * path), so each thumbnail mints its own short-lived URL on demand (one query per document).
 */

/**
 * Visual treatment per verification status (pill class + leading icon + label). `unverified` should not
 * appear in the queue (the queue lists applications) but is mapped for completeness so the pill never
 * crashes on an unexpected value.
 */
const STATUS_VIEW: Record<
  VerificationStatus,
  { cls: string; label: string; icon: typeof Icons.Clock }
> = {
  unverified: { cls: "priority-low", label: "Unverified", icon: Icons.Shield },
  pending: { cls: "status-new", label: "Pending", icon: Icons.Clock },
  verified: { cls: "status-ok", label: "Verified", icon: Icons.Check },
  rejected: { cls: "status-flag", label: "Rejected", icon: Icons.X },
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/** The server returns a "-" sentinel for an absent timestamp; treat it (and empty) as missing. */
function isMissing(v: string | null | undefined): boolean {
  const t = (v ?? "").trim()
  return t === "" || t === "-"
}

/** Best-effort date-only rendering of an ISO timestamp; falls back to the raw string if unparseable. */
function fmtDate(v: string | null): string {
  if (isMissing(v)) return "—"
  const d = new Date(v as string)
  if (Number.isNaN(d.getTime())) return v as string
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

/**
 * One uploaded document thumbnail. Mints its own short-lived signed URL (verification media is never
 * served by the public media path) and renders it in the standard `.rep-photo` frame, matching the
 * reports-detail photo treatment. While the URL is in flight or unavailable it shows the framed
 * placeholder.
 */
function DocumentThumb({
  userId,
  doc,
  index,
}: {
  userId: string
  doc: VerificationDocument
  index: number
}) {
  const q = useVerificationDocumentUrl(userId, doc.mediaId)
  const url = q.data?.url ?? null
  return (
    <div className="rep-photo" style={{ ["--cat" as string]: "var(--sky)" }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="rep-photo-img" src={url} alt={`Document ${index + 1}`} />
      ) : (
        <span className="rep-photo-pin" style={{ background: "var(--sky)" }}>
          {q.isError ? <Icons.AlertTriangle size={14} /> : <Icons.FileText size={14} />}
        </span>
      )}
      <span className="rep-photo-tag">
        <Icons.FileText size={12} /> Doc {index + 1}
      </span>
    </div>
  )
}

function VerificationDetail({ dto }: { dto: AdminVerificationDTO }) {
  const toast = useToast()
  const approve = useApproveVerification()
  const reject = useRejectVerification()

  // Reject is two-step: revealing the inline reason textarea, then confirming with a non-empty reason.
  const [rejecting, setRejecting] = React.useState(false)
  const [reason, setReason] = React.useState("")

  const view = STATUS_VIEW[dto.status]
  const StatusIcon = view.icon
  const decided = dto.status === "verified" || dto.status === "rejected"
  const busy = approve.isPending || reject.isPending

  const onApprove = () => {
    approve.mutate(
      { userId: dto.userId },
      {
        onSuccess: () => toast(`${dto.userName} · verified`),
        onError: (e) => toast(errorMessage(e, {}, { fallback: "Could not approve" })),
      },
    )
  }

  const onReject = () => {
    const r = reason.trim()
    if (!r) return
    reject.mutate(
      { userId: dto.userId, reason: r },
      {
        onSuccess: () => {
          setRejecting(false)
          setReason("")
          toast(`${dto.userName} · verification rejected`)
        },
        onError: (e) => toast(errorMessage(e, {}, { fallback: "Could not reject" })),
      },
    )
  }

  return (
    <div className="rep-detail">
      <div className="rep-head">
        <span
          className="user-av lg"
          style={{ background: "linear-gradient(135deg, var(--sky), var(--moss))" }}
        >
          {initials(dto.userName)}
        </span>
        <div className="rep-head-text">
          <div className="crumb">Verification · applied {fmtDate(dto.appliedAt)}</div>
          <h2>{dto.userName}</h2>
        </div>
        <span className={`pill ${view.cls}`} style={{ marginLeft: "auto" }}>
          <StatusIcon size={11} /> {view.label}
        </span>
      </div>

      <div className="rep-grid">
        <div className="rep-col">
          {/* Applicant */}
          <div className="sub">
            <div className="sub-head">Applicant</div>
            <div className="sub-body">
              <div className="profile-meta" style={{ marginLeft: 0, marginRight: 0 }}>
                <span className="pm-item">
                  <Icons.Users size={13} />
                  <span className="mono">{dto.handle && !isMissing(dto.handle) ? dto.handle : "—"}</span>
                </span>
                <span className="pm-item">
                  <Icons.Calendar size={13} /> Applied {fmtDate(dto.appliedAt)}
                </span>
                {!isMissing(dto.reviewedAt) && (
                  <span className="pm-item">
                    <Icons.Check size={13} /> Reviewed {fmtDate(dto.reviewedAt)}
                    {!isMissing(dto.reviewedBy) && <> · {dto.reviewedBy}</>}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Applicant note to the reviewer */}
          <div className="sub">
            <div className="sub-head">Note from applicant</div>
            <div className="sub-body">
              {dto.note && dto.note.trim() ? (
                <p className="rep-desc">{dto.note}</p>
              ) : (
                <div className="hint">No note was provided.</div>
              )}
            </div>
          </div>

          {/* Prior rejection reason (when this application was previously rejected) */}
          {dto.status === "rejected" && !isMissing(dto.rejectionReason) && (
            <div className="sub">
              <div className="sub-head">Rejection reason</div>
              <div className="sub-body">
                <p className="rep-desc">{dto.rejectionReason}</p>
              </div>
            </div>
          )}
        </div>

        <div className="rep-col">
          {/* Uploaded documents */}
          <div className="sub">
            <div className="sub-head">
              Documents
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>
                {dto.documents.length} uploaded
              </span>
            </div>
            <div className="sub-body" style={{ padding: 10 }}>
              {dto.documents.length === 0 ? (
                <div className="hint">No documents were uploaded.</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {dto.documents.map((doc, i) => (
                    <DocumentThumb key={doc.mediaId} userId={dto.userId} doc={doc} index={i} />
                  ))}
                </div>
              )}
              <div className="hint" style={{ marginTop: 10 }}>
                Documents are private — each opens via a short-lived signed link, never the public media
                path.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reject reason composer (revealed by "Reject") */}
      {rejecting && (
        <div className="sub" style={{ marginTop: 14 }}>
          <div className="sub-head">Reason for rejection</div>
          <div className="sub-body">
            <div className="field" style={{ marginTop: 0, marginBottom: 0 }}>
              <textarea
                placeholder="Tell the applicant what to fix or resubmit…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                autoFocus
              />
            </div>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="rep-actions">
        <span className="rep-actions-label">
          {decided ? view.label : "Awaiting review"}
        </span>
        <div className="spacer" />
        {rejecting ? (
          <>
            <button className="btn" disabled={busy} onClick={() => setRejecting(false)}>
              Cancel
            </button>
            <button
              className="btn danger"
              disabled={busy || !reason.trim()}
              onClick={onReject}
              style={!reason.trim() ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
            >
              <Icons.X size={13} /> Confirm reject
            </button>
          </>
        ) : (
          <>
            <button
              className="btn danger"
              disabled={busy || dto.status === "rejected"}
              onClick={() => setRejecting(true)}
            >
              <Icons.X size={13} /> {dto.status === "rejected" ? "Rejected" : "Reject"}
            </button>
            <button
              className={`btn ${dto.status === "verified" ? "" : "success"}`}
              disabled={busy || dto.status === "verified"}
              onClick={onApprove}
              style={dto.status === "verified" ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
            >
              <Icons.Check size={13} /> {dto.status === "verified" ? "Verified" : "Approve"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Loads the full application for the selected user id, then renders the detail. */
function VerificationDetailLoader({ userId }: { userId: string }) {
  const q = useVerification(userId)
  if (q.isLoading) return <LoadingState label="Loading application…" />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const dto = q.data
  if (!dto) {
    return (
      <EmptyState
        title="No application selected"
        sub="Pick an applicant from the list."
        icon={<Icons.Shield size={20} />}
      />
    )
  }
  return <VerificationDetail key={dto.userId} dto={dto} />
}

function VerificationRow({
  item,
  selected,
  onClick,
}: {
  item: AdminVerificationDTO
  selected: boolean
  onClick: () => void
}) {
  const view = STATUS_VIEW[item.status]
  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={onClick}>
      <span
        className="user-av"
        style={{ background: "linear-gradient(135deg, var(--sky), var(--moss))" }}
      >
        {initials(item.userName)}
      </span>
      <div className="body">
        <div className="top">
          <span className="title">{item.userName}</span>
          <span className="ident">{item.handle && !isMissing(item.handle) ? item.handle : "—"}</span>
        </div>
        <div className="sub">
          <span className="strong">{item.documents.length} docs</span>
          <span className="sep">·</span>
          <span>applied {fmtDate(item.appliedAt)}</span>
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${view.cls} tight`}>{view.label}</span>
      </div>
    </div>
  )
}

export function VerificationPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState("pending")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const listParams = {
    filter: filter === "all" ? undefined : (filter as "pending" | "verified" | "rejected"),
    q: query.trim() || undefined,
  }
  const listQuery = useVerifications(listParams)
  const items = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data])

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.userId)
    if (selId && items.length && !items.some((x) => x.userId === selId)) setSelId(items[0]!.userId)
  }, [items, selId])

  return (
    <>
      <PageHead
        title="Verification"
        subtitle={
          <span>
            Neighbors who applied to be a verified neighbor. Review the documents they uploaded, then
            approve or send them back with a reason.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={[
            { value: "pending", label: "Pending" },
            { value: "verified", label: "Verified" },
            { value: "rejected", label: "Rejected" },
            { value: "all", label: "All" },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            placeholder="Search name or handle…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Applications</h3>
            <div className="spacer" />
            <span className="meta">{items.length}</span>
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading applications…" />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                title="Nothing here"
                sub="No verification requests match this filter."
                icon={<Icons.Shield size={20} />}
              />
            ) : (
              items.map((v) => (
                <VerificationRow
                  key={v.userId}
                  item={v}
                  selected={selId === v.userId}
                  onClick={() => setSelId(v.userId)}
                />
              ))
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            <VerificationDetailLoader key={selId} userId={selId} />
          ) : (
            <EmptyState
              title="No application selected"
              sub="Pick an applicant from the list."
              icon={<Icons.Shield size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

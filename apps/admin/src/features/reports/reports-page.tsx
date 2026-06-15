"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import {
  ADMIN_REPORT_STATUS_LABELS,
  REPORT_CATEGORY_LABELS,
  type AdminReportDTO,
  type AdminReportListItemDTO,
  type AdminReportStatus,
  type ReportCategory,
} from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { reportBucket, reportStatusView } from "@/lib/report-status"
import {
  useFlagReport,
  useRemoveReport,
  useReport,
  useReportList,
  useSendReportFollowup,
  useSetReportStatus,
} from "@/features/reports/use-reports"
import { useNav, useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Reports (ported from pages-reports.jsx, enumeration 2.C). Master-detail: the report queue on the left
 * (filter chips All / Submitted / In progress / Completed / Flagged, search) and the full report detail
 * on the right (description, location + minimap, activity timeline, reporter, routing, follow-up
 * composer, and the action bar: quick status, flag, remove). All wired to the typed admin client.
 *
 * Reconciliation: the design's submitted|in-progress|completed becomes the civfix status enum. The
 * quick-status buttons drive the three real buckets (submitted | in_progress | resolved); the row /
 * header pill render the design bucket label for whatever civfix status the DTO carries via the canonical
 * reportStatusView helper (src/lib/report-status.ts). "flagged" is the orthogonal abuse marker, not a
 * status. NOTE: a freshly created authed pin is `published` (live, awaiting city action) — it reads as
 * "Submitted", NOT "Completed".
 */

// Client-only Leaflet minimap (must not run during the static export).
const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="pi-map-canvas" aria-busy="true" />,
})

/** The three quick-status buckets (the design's Submitted / In progress / Completed). */
const STATUS_ACTIONS: { value: AdminReportStatus; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Completed" },
]

/** Icon per timeline entry kind (ported from TL_ICON). */
const TL_ICON: Record<AdminReportDTO["timeline"][number]["kind"], IconComponent> = {
  submit: Icons.Pin,
  route: Icons.Send,
  confirm: Icons.Users,
  status: Icons.Clock,
  done: Icons.Check,
  warn: Icons.AlertTriangle,
  followup: Icons.Mail,
  remove: Icons.Trash,
}

function catPinSrc(category: ReportCategory): string | null {
  if (category === "other") return null
  return `/ds/pin-${category}.svg`
}

/** Per-category hue var for the held-photo placeholder tint ("other" -> neutral ink). */
function catColor(category: ReportCategory): string {
  if (category === "other") return "var(--ink-4)"
  return `var(--cat-${category})`
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/** A human-friendly short report id ("#" + first 8 chars of the uuid) for display only. */
function shortId(id: string): string {
  return `#${id.slice(0, 8)}`
}

/** Pluralize a noun against a count: pluralize(1, "confirm") -> "1 confirm". */
function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}

const ReportRow = React.memo(function ReportRow({
  item,
  selected,
  onSelect,
}: {
  item: AdminReportListItemDTO
  selected: boolean
  // Stable setter from the parent (React.useState's dispatcher keeps identity), so memoized rows
  // only re-render when their own `item`/`selected` actually change — not on every keystroke.
  onSelect: (id: string) => void
}) {
  const view = reportStatusView(item.status)
  const pin = catPinSrc(item.category)
  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={() => onSelect(item.id)}>
      <div className="leading has-pin" title={REPORT_CATEGORY_LABELS[item.category]}>
        {pin ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pin} alt="" />
        ) : (
          <Icons.Layers size={16} />
        )}
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{item.title}</span>
          {item.flagged && (
            <span className="rep-flag-dot" title="Flagged">
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
          <span>{firstName(item.reporter.name)}</span>
          <span className="sep">·</span>
          <span>{pluralize(item.confirmations, "confirm")}</span>
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${view.cls} tight`}>{view.label}</span>
        <span className="age">{item.submitted.rel}</span>
      </div>
    </div>
  )
})

function ReportDetail({ reportId, onRemoved }: { reportId: string; onRemoved: (id: string) => void }) {
  const q = useReport(reportId)
  const nav = useNav()
  const toast = useToast()

  const setStatus = useSetReportStatus()
  const flag = useFlagReport()
  const remove = useRemoveReport()
  const followup = useSendReportFollowup()

  const [to, setTo] = React.useState<"reporter" | "city">("reporter")
  const [text, setText] = React.useState("")

  if (q.isLoading) return <LoadingState label="Loading report..." />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const report = q.data
  if (!report) return null

  const view = reportStatusView(report.status)
  const canCity = !!report.city.contact
  // A follow-up to the reporter needs a reporter account to notify. An anonymous report has none (the API
  // rejects it with a 422), so the "Reporter" tab is gated exactly like "City" — issue #12.
  const canReporter = !!report.reporter.id
  // Never target a channel that doesn't exist: if "reporter" is selected but unreachable, fall back to city.
  const target: "reporter" | "city" = to === "reporter" && !canReporter ? "city" : to
  const canSend = target === "reporter" ? canReporter : canCity
  const pin = catPinSrc(report.category)
  // The best still to show in the 116px box. media now carries presigned, browser-loadable URLs: prefer the
  // first image (thumb over full), else a video's poster thumbnail. A video with no generated poster has no
  // image to render, so we leave photoUrl null and fall back to the category-pin placeholder rather than
  // putting a video URL in an <img>. Null -> placeholder.
  const previewMedia = report.media.find((m) => m.kind === "image") ?? report.media[0]
  const photoUrl = previewMedia
    ? previewMedia.kind === "image"
      ? (previewMedia.thumbUrl ?? previewMedia.url)
      : (previewMedia.thumbUrl ?? null)
    : null

  const send = () => {
    const body = text.trim()
    if (!body || !canSend) return
    followup.mutate(
      { id: report.id, to: target, body },
      {
        onSuccess: () => {
          setText("")
          toast(`Follow-up sent to ${target === "reporter" ? "reporter" : "city"}`)
        },
      },
    )
  }

  const onStatus = (status: AdminReportStatus) => {
    // The quick-status buttons act on BUCKETS, not raw statuses: a `published` report is already in the
    // Submitted bucket, so clicking "Submitted" is a no-op rather than a downgrade to literal `submitted`.
    if (reportBucket(report.status) === reportBucket(status)) return
    setStatus.mutate(
      { id: report.id, status },
      { onSuccess: () => toast(`${shortId(report.id)} · status → ${ADMIN_REPORT_STATUS_LABELS[status]}`) },
    )
  }

  const onFlag = () => {
    flag.mutate(
      { id: report.id },
      {
        onSuccess: () =>
          toast(
            report.flagged
              ? `${shortId(report.id)} · flag cleared`
              : `${shortId(report.id)} · flagged for review`,
          ),
      },
    )
  }

  const onRemove = () => {
    remove.mutate(
      { id: report.id },
      {
        onSuccess: () => {
          toast(`${shortId(report.id)} · report removed`)
          onRemoved(report.id)
        },
      },
    )
  }

  return (
    <div className="rep-detail">
      {/* Header */}
      <div className="rep-head">
        <span className="rep-head-pin">
          {pin ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pin} alt="" />
          ) : (
            <Icons.Layers size={22} />
          )}
        </span>
        <div className="rep-head-text">
          <div className="crumb" title={report.id}>
            {shortId(report.id)} · {REPORT_CATEGORY_LABELS[report.category]} · {report.place}
          </div>
          <h2>{report.title}</h2>
        </div>
        {report.flagged && (
          <span className="pill status-flag" style={{ marginLeft: "auto" }}>
            <Icons.Flag size={11} /> Flagged
          </span>
        )}
        <span
          className={`pill ${view.cls}`}
          style={report.flagged ? undefined : { marginLeft: "auto" }}
        >
          {view.label}
        </span>
      </div>

      <div className="rep-grid">
        <div className="rep-col">
          {/* Description */}
          <div className="sub">
            <div className="sub-head">
              Report
              <span className="rep-confirms" style={{ marginLeft: "auto" }}>
                <Icons.Users size={12} />{" "}
                {report.confirmations === 1
                  ? "1 neighbor confirmed"
                  : `${report.confirmations} neighbors confirmed`}
              </span>
            </div>
            <div className="sub-body">
              <p className="rep-desc">{report.desc}</p>
              <div className="rep-loc">
                <span className="rep-loc-item">
                  <Icons.Pin size={13} /> {report.address}
                </span>
                <span className="rep-loc-sep">·</span>
                <span className="rep-loc-item">
                  <Icons.Clock size={13} /> Submitted {report.submitted.abs}
                </span>
              </div>
            </div>
          </div>

          {/* Photo + location */}
          <div className="sub">
            <div className="sub-head">
              Location
              {report.hasPhoto && (
                <span
                  style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)", fontWeight: 600 }}
                >
                  photo attached
                </span>
              )}
            </div>
            <div className="sub-body" style={{ padding: 10 }}>
              <div className="rep-media">
                {report.hasPhoto && (
                  <div className="rep-photo" style={{ ["--cat" as string]: catColor(report.category) }}>
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="rep-photo-img" src={photoUrl} alt="Reporter photo" />
                    ) : (
                      <span className="rep-photo-pin" style={{ background: catColor(report.category) }}>
                        {pin ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pin} alt="" />
                        ) : (
                          <Icons.Layers size={14} />
                        )}
                      </span>
                    )}
                    <span className="rep-photo-tag">
                      <Icons.Eye size={12} /> Reporter photo
                    </span>
                  </div>
                )}
                <div className="rep-minimap">
                  <LeafletMap
                    pins={[
                      {
                        id: "r",
                        category: report.category,
                        lat: report.coords[0],
                        lng: report.coords[1],
                      },
                    ]}
                    center={report.coords}
                    zoom={14}
                    tint="voyager"
                    interactive={false}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Activity timeline */}
          <div className="sub">
            <div className="sub-head">Activity</div>
            <div className="sub-body">
              {report.timeline.length === 0 ? (
                <EmptyState
                  title="No activity yet"
                  sub="Updates appear here as this report is routed, confirmed, and resolved."
                  icon={<Icons.Clock size={20} />}
                />
              ) : (
                <div className="rep-timeline">
                  {report.timeline.map((t, i) => {
                  const Ico = TL_ICON[t.kind] ?? Icons.Clock
                  return (
                    <div
                      // eslint-disable-next-line react/no-array-index-key
                      key={i}
                      className={`rep-tl-row kind-${t.kind}`}
                    >
                      <span className="rep-tl-ico">
                        <Ico size={12} />
                      </span>
                      <div className="rep-tl-body">
                        <div className="rep-tl-text">
                          <b>{t.who}</b> {t.what}
                        </div>
                        <div className="rep-tl-when">{t.when}</div>
                      </div>
                    </div>
                  )
                })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rep-col">
          {/* Reporter */}
          <div className="sub">
            <div className="sub-head">Reporter</div>
            <div className="sub-body">
              <div className="user-head">
                <span
                  className="user-av"
                  style={{ background: "linear-gradient(135deg, var(--sky), var(--moss))" }}
                >
                  {initials(report.reporter.name)}
                </span>
                <div>
                  <div className="user-name">{report.reporter.name}</div>
                  <div className="user-handle mono">{report.reporter.handle}</div>
                </div>
              </div>
              <div className="user-meta-rows">
                <div className="umr">
                  <span>Joined</span>
                  <span className="mono">{report.reporter.joined}</span>
                </div>
              </div>
              <button className="btn sm ghost full" onClick={() => nav("users", report.reporter.id)}>
                View full account →
              </button>
            </div>
          </div>

          {/* Routed city / department */}
          <div className="sub">
            <div className="sub-head">Routed to</div>
            <div className="sub-body">
              <div className="rep-city">
                <span className="rep-city-ico">
                  <Icons.Building size={15} />
                </span>
                <div>
                  <div className="rep-city-dept">{report.city.dept}</div>
                  {report.city.dept !== report.place && (
                    <div className="rep-city-place">{report.place}</div>
                  )}
                </div>
              </div>
              {canCity ? (
                <div className="rep-city-contact">
                  <Icons.Mail size={12} />
                  <span className="mono">{report.city.contact}</span>
                </div>
              ) : (
                <div className="rep-city-contact warn">
                  <Icons.AlertTriangle size={12} />
                  <span>No contact on file — set one in Jurisdictions</span>
                </div>
              )}
            </div>
          </div>

          {/* Follow-up composer */}
          <div className="sub">
            <div className="sub-head">Send a follow-up</div>
            <div className="sub-body">
              <div className="rep-to">
                <button
                  className={`rep-to-btn ${target === "reporter" ? "on" : ""}`}
                  onClick={() => canReporter && setTo("reporter")}
                  disabled={!canReporter}
                  title={canReporter ? "" : "Anonymous report — no reporter account to message"}
                >
                  <Icons.Users size={12} /> Reporter
                </button>
                <button
                  className={`rep-to-btn ${target === "city" ? "on" : ""}`}
                  onClick={() => canCity && setTo("city")}
                  disabled={!canCity}
                  title={canCity ? "" : "No city contact on file"}
                >
                  <Icons.Building size={12} /> City
                </button>
              </div>
              <textarea
                className="rep-followup"
                rows={3}
                placeholder={
                  target === "reporter"
                    ? `Message ${firstName(report.reporter.name)} — e.g. a status update or a question…`
                    : `Message ${report.city.dept} — e.g. nudge for an update…`
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                className="btn primary full"
                disabled={!text.trim() || !canSend || followup.isPending}
                onClick={send}
                style={!text.trim() || !canSend ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              >
                <Icons.Send size={13} /> Send to {target === "reporter" ? "reporter" : "city"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="rep-actions">
        <span className="rep-actions-label">Quick status</span>
        {STATUS_ACTIONS.map((s) => {
          // Active when the report's CURRENT status shares this button's bucket (so a `published` report
          // shows "Submitted" as the active step, not nothing).
          const active = reportBucket(report.status) === reportBucket(s.value)
          return (
            <button
              key={s.value}
              className={`btn sm ${active ? "primary" : ""}`}
              disabled={setStatus.isPending}
              onClick={() => onStatus(s.value)}
            >
              {active && <Icons.Check size={11} />}
              {s.label}
            </button>
          )
        })}
        <div className="spacer" />
        <button
          className={`btn ${report.flagged ? "flag-on" : ""}`}
          disabled={flag.isPending}
          onClick={onFlag}
        >
          <Icons.Flag size={13} /> {report.flagged ? "Flagged" : "Flag"}
        </button>
        <button className="btn danger" disabled={remove.isPending} onClick={onRemove}>
          <Icons.Trash size={13} /> Remove report
        </button>
      </div>
    </div>
  )
}

export function ReportsPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const listParams = {
    filter:
      filter === "all"
        ? undefined
        : (filter as "submitted" | "in_progress" | "completed" | "flagged"),
    q: query.trim() || undefined,
  }
  const listQuery = useReportList(listParams)
  const items = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data])

  // Chip counts come from the SERVER (response.counts): accurate per-bucket totals over the searched set,
  // not capped to the first keyset page and stable as the status facet changes. The backend buckets
  // published/held as Submitted (a live pin), matching the pills. Falls back to zeros pre-load.
  const counts = listQuery.data?.counts ?? {
    all: 0,
    submitted: 0,
    in_progress: 0,
    completed: 0,
    flagged: 0,
  }

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.id)
    if (selId && items.length && !items.some((x) => x.id === selId)) setSelId(items[0]!.id)
  }, [items, selId])

  // After a removal, drop the selection so the effect re-selects the first remaining row.
  const onRemoved = (id: string) => {
    setSelId((cur) => (cur === id ? null : cur))
  }

  return (
    <>
      <PageHead
        title="Reports"
        subtitle={
          <span>
            Every report neighbors submit — routed to the right city department. Track status, follow up
            with the reporter or the city, and close the loop.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "submitted", label: "Submitted", count: counts.submitted },
            { value: "in_progress", label: "In progress", count: counts.in_progress },
            { value: "completed", label: "Completed", count: counts.completed },
            { value: "flagged", label: "Flagged", count: counts.flagged },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            placeholder="Search title, place, reporter…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Reports</h3>
            <div className="spacer" />
            <span className="meta">{items.length}</span>
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading reports..." />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                title="Nothing matches"
                sub="Try a different filter or search."
                icon={<Icons.Search size={20} />}
              />
            ) : (
              items.map((r) => (
                // Pass the stable `setSelId` dispatcher (not a fresh arrow) so memoized rows don't
                // all re-render on each parent render; the row calls onSelect(item.id) on click.
                <ReportRow key={r.id} item={r} selected={selId === r.id} onSelect={setSelId} />
              ))
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            <ReportDetail key={selId} reportId={selId} onRemoved={onRemoved} />
          ) : (
            <EmptyState
              title="No report selected"
              sub="Pick a report from the list."
              icon={<Icons.FileText size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

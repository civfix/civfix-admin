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
 * header pill render whatever civfix status the DTO carries via ADMIN_REPORT_STATUS_LABELS. "flagged"
 * is the orthogonal abuse marker, not a status.
 */

// Client-only Leaflet minimap (must not run during the static export).
const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <div className="pi-map-canvas" aria-busy="true" />,
})

/** Visual treatment per civfix report status (pill class + icon). */
const STATUS_VIEW: Record<AdminReportStatus, { cls: string; icon: IconComponent }> = {
  submitted: { cls: "status-new", icon: Icons.Inbox },
  held: { cls: "status-progress", icon: Icons.Clock },
  published: { cls: "status-ok", icon: Icons.Check },
  acknowledged: { cls: "status-progress", icon: Icons.Clock },
  in_progress: { cls: "status-progress", icon: Icons.Clock },
  resolved: { cls: "status-ok", icon: Icons.Check },
  rejected: { cls: "status-flag", icon: Icons.Trash },
}

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

function ReportRow({
  item,
  selected,
  onClick,
}: {
  item: AdminReportListItemDTO
  selected: boolean
  onClick: () => void
}) {
  const view = STATUS_VIEW[item.status]
  const pin = catPinSrc(item.category)
  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={onClick}>
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
          <span className="ident">{item.id}</span>
        </div>
        <div className="sub">
          <span className="strong">{item.place}</span>
          <span className="sep">-</span>
          <span>{firstName(item.reporter.name)}</span>
          <span className="sep">-</span>
          <span>{item.confirmations} confirms</span>
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${view.cls} tight`}>{ADMIN_REPORT_STATUS_LABELS[item.status]}</span>
        <span className="age">{item.submitted.rel.replace(" ago", "")}</span>
      </div>
    </div>
  )
}

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
  if (!report) {
    return (
      <EmptyState
        title="No report selected"
        sub="Pick a report from the list."
        icon={<Icons.FileText size={20} />}
      />
    )
  }

  const view = STATUS_VIEW[report.status]
  const canCity = !!report.city.contact
  const pin = catPinSrc(report.category)

  const send = () => {
    const body = text.trim()
    if (!body) return
    followup.mutate(
      { id: report.id, to, body },
      {
        onSuccess: () => {
          setText("")
          toast(`Follow-up sent to ${to === "reporter" ? "reporter" : "city"}`)
        },
      },
    )
  }

  const onStatus = (status: AdminReportStatus) => {
    if (report.status === status) return
    setStatus.mutate(
      { id: report.id, status },
      { onSuccess: () => toast(`${report.id} - status -> ${ADMIN_REPORT_STATUS_LABELS[status]}`) },
    )
  }

  const onFlag = () => {
    flag.mutate(
      { id: report.id },
      {
        onSuccess: () =>
          toast(report.flagged ? `${report.id} - flag cleared` : `${report.id} - flagged for review`),
      },
    )
  }

  const onRemove = () => {
    remove.mutate(
      { id: report.id },
      {
        onSuccess: () => {
          toast(`${report.id} - report removed`)
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
          <div className="crumb">
            {report.id} - {REPORT_CATEGORY_LABELS[report.category]} - {report.place}
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
          {ADMIN_REPORT_STATUS_LABELS[report.status]}
        </span>
      </div>

      <div className="rep-grid">
        <div className="rep-col">
          {/* Description */}
          <div className="sub">
            <div className="sub-head">
              Report
              <span className="rep-confirms" style={{ marginLeft: "auto" }}>
                <Icons.Users size={12} /> {report.confirmations} neighbors confirmed
              </span>
            </div>
            <div className="sub-body">
              <p className="rep-desc">{report.desc}</p>
              <div className="rep-loc">
                <span className="rep-loc-item">
                  <Icons.Pin size={13} /> {report.address}
                </span>
                <span className="rep-loc-sep">-</span>
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
                  <div className="rep-photo">
                    <span className="rep-photo-pin">
                      {pin ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={pin} alt="" />
                      ) : (
                        <Icons.Layers size={14} />
                      )}
                    </span>
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
                  style={{
                    background:
                      report.reporter.trust === "Unverified"
                        ? "var(--ink-4)"
                        : "linear-gradient(135deg, var(--sky), var(--moss))",
                  }}
                >
                  {initials(report.reporter.name)}
                </span>
                <div>
                  <div className="user-name">{report.reporter.name}</div>
                  <div className="user-handle mono">{report.reporter.handle}</div>
                </div>
              </div>
              <div
                className={`trust-badge ${
                  report.reporter.trust === "Unverified" ? "unverified" : "verified"
                }`}
              >
                {report.reporter.trust === "Unverified" ? (
                  <Icons.AlertTriangle size={11} />
                ) : (
                  <Icons.Check size={11} />
                )}
                {report.reporter.trust}
              </div>
              <div className="user-meta-rows">
                <div className="umr">
                  <span>Member</span>
                  <span className="mono">{report.reporter.joined}</span>
                </div>
              </div>
              <button className="btn sm ghost full" onClick={() => nav("users", report.reporter.id)}>
                View full account -&gt;
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
                  <div className="rep-city-place">{report.place}</div>
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
                  <span>No contact on file - set one in Jurisdictions</span>
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
                  className={`rep-to-btn ${to === "reporter" ? "on" : ""}`}
                  onClick={() => setTo("reporter")}
                >
                  <Icons.Users size={12} /> Reporter
                </button>
                <button
                  className={`rep-to-btn ${to === "city" ? "on" : ""}`}
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
                  to === "reporter"
                    ? `Message ${firstName(report.reporter.name)} - e.g. a status update or a question...`
                    : `Message ${report.city.dept} - e.g. nudge for an update...`
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                className="btn primary full"
                disabled={!text.trim() || followup.isPending}
                onClick={send}
                style={!text.trim() ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              >
                <Icons.Send size={13} /> Send to {to === "reporter" ? "reporter" : "city"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="rep-actions">
        <span className="rep-actions-label">Quick status</span>
        {STATUS_ACTIONS.map((s) => (
          <button
            key={s.value}
            className={`btn sm ${report.status === s.value ? "primary" : ""}`}
            disabled={setStatus.isPending}
            onClick={() => onStatus(s.value)}
          >
            {report.status === s.value && <Icons.Check size={11} />}
            {s.label}
          </button>
        ))}
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

  // Unfiltered fetch for stable chip counts across filters.
  const allQuery = useReportList({})
  const allItems = React.useMemo(() => allQuery.data?.items ?? [], [allQuery.data])
  const counts = {
    all: allItems.length,
    submitted: allItems.filter((r) => r.status === "submitted").length,
    in_progress: allItems.filter((r) => r.status === "in_progress").length,
    completed: allItems.filter((r) => r.status === "resolved").length,
    flagged: allItems.filter((r) => r.flagged).length,
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
            Every report neighbors submit - routed to the right city department. Track status, follow up
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
            placeholder="Search title, place, reporter..."
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
                <ReportRow
                  key={r.id}
                  item={r}
                  selected={selId === r.id}
                  onClick={() => setSelId(r.id)}
                />
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

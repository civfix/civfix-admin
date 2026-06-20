"use client"

import * as React from "react"
import {
  MODERATION_KIND_LABELS,
  type ModerationItemDTO,
  type ModerationKind,
  type ModerationListItemDTO,
  type ModerationListQuery,
  type ModerationSignal,
  type ModerationSubjectType,
  type ModerationTone,
  type Priority,
} from "@civfix/shared"

import { Icons, type IconComponent } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import {
  useApproveModeration,
  useAppealModeration,
  useHoldModeration,
  useModerationItem,
  useModerationList,
  useRemoveModeration,
} from "@/features/moderation/use-moderation"
import { useToast } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

/**
 * Moderation (the UGC content-report queue + held media / clusters / appeals). Master-detail clone of
 * reports-page.tsx: the queue on the left (filter chips All / User reports / Image / Pattern / Appeal /
 * GPS / Duplicate / High + search), and the full item detail on the right (description, signals grid,
 * user-context snapshot, media, similar items, and the action bar: Approve / Remove / Hold / Appeal).
 *
 * Citizen "Report" flags arrive as `kind === "user_report"` items carrying a `subjectType` (the kind of
 * content reported: comment / message / event / report / profile / photo). The list query's `filter`
 * union (a frozen @civfix/shared contract: all|image|pattern|appeal|gps|duplicate|high) does NOT carry a
 * `user_report` value, so the "User reports" chip fetches `all` and filters CLIENT-SIDE on
 * `kind === "user_report"` (see USER_REPORTS_CHIP + the items memo below). Everything else maps 1:1.
 */

/** The list-query `filter` values the backend accepts (the frozen ModerationListQuery union). */
type ServerFilter = NonNullable<ModerationListQuery["filter"]>

/**
 * The synthetic chip value for citizen content reports. It is NOT a server filter (the frozen contract's
 * filter union omits `user_report`); selecting it fetches `all` and narrows client-side on kind. Kept
 * distinct from any ServerFilter so the union below stays exhaustive.
 */
const USER_REPORTS_CHIP = "user_reports" as const
type ChipValue = "all" | typeof USER_REPORTS_CHIP | ServerFilter

/** Priority pill treatment (low|med|high → the design `.pill status-*` classes). */
const PRIORITY_VIEW: Record<Priority, { cls: string; label: string }> = {
  low: { cls: "status-new", label: "Low" },
  med: { cls: "status-progress", label: "Med" },
  high: { cls: "status-flag", label: "High" },
}

/** Signal-tone pill treatment (ok|warn|bad → the design `.pill status-*` classes). */
const TONE_VIEW: Record<ModerationTone, { cls: string }> = {
  ok: { cls: "status-ok" },
  warn: { cls: "status-progress" },
  bad: { cls: "status-flag" },
}

/** Icon per moderation kind (the leading glyph in a queue row). */
const KIND_ICON: Record<ModerationKind, IconComponent> = {
  image: Icons.Eye,
  pattern: Icons.Activity,
  appeal: Icons.MessageSquare,
  gps: Icons.Pin,
  duplicate: Icons.Copy,
  user_report: Icons.Flag,
}

/**
 * Human label for what KIND of content a citizen report points at (ModerationSubjectType). Used to build
 * the row header ("Reported comment" / "Reported message" / ...). A held-media/cluster/appeal item with
 * no subjectType falls back to its kind label.
 */
const SUBJECT_LABEL: Record<ModerationSubjectType, string> = {
  report: "report",
  user: "user",
  chat: "chat",
  comment: "comment",
  message: "message",
  event: "event",
  profile: "profile",
  photo: "photo",
}

/**
 * The row title line. For a citizen content report we say "Reported <subject>" (e.g. "Reported comment");
 * otherwise we use the item's kind label (Image / Pattern / Appeal / GPS / Duplicate).
 */
function rowKindLabel(item: ModerationListItemDTO): string {
  if (item.kind === "user_report" && item.subjectType) {
    return `Reported ${SUBJECT_LABEL[item.subjectType] ?? item.subjectType}`
  }
  return MODERATION_KIND_LABELS[item.kind]
}

function ModerationRow({
  item,
  selected,
  onSelect,
}: {
  item: ModerationListItemDTO
  selected: boolean
  // Stable setter from the parent (React.useState's dispatcher keeps identity) so memoized rows only
  // re-render when their own item/selected actually change — not on every keystroke.
  onSelect: (id: string) => void
}) {
  const KindIco = KIND_ICON[item.kind] ?? Icons.Shield
  const priority = PRIORITY_VIEW[item.priority] ?? PRIORITY_VIEW.low
  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={() => onSelect(item.id)}>
      <span className="prow-ico hue-lilac" title={MODERATION_KIND_LABELS[item.kind]}>
        <KindIco size={15} />
      </span>
      <div className="body">
        <div className="top">
          <span className="title">{rowKindLabel(item)}</span>
          <span className="ident">{item.flag}</span>
        </div>
        <div className="sub">
          <span className="strong">{item.reason}</span>
          <span className="sep">·</span>
          <span>{item.reporter}</span>
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${priority.cls} tight`}>{priority.label}</span>
        <span className="age">{item.age}</span>
      </div>
    </div>
  )
}

const ModerationRowMemo = React.memo(ModerationRow)

/** One signal cell in the detail signals grid (label / value / tone pill). */
function SignalCell({ signal }: { signal: ModerationSignal }) {
  const tone = TONE_VIEW[signal.tone] ?? TONE_VIEW.ok
  return (
    <div className="umr">
      <span>{signal.label}</span>
      <span className={`pill ${tone.cls} tight`}>{signal.val}</span>
    </div>
  )
}

function ModerationDetail({ itemId, onResolved }: { itemId: string; onResolved: (id: string) => void }) {
  const q = useModerationItem(itemId)
  const toast = useToast()

  const approve = useApproveModeration()
  const remove = useRemoveModeration()
  const hold = useHoldModeration()
  const appeal = useAppealModeration()

  const busy = approve.isPending || remove.isPending || hold.isPending || appeal.isPending

  if (q.isLoading) return <LoadingState label="Loading item..." />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const item: ModerationItemDTO | undefined = q.data
  if (!item) return null

  const priority = PRIORITY_VIEW[item.priority] ?? PRIORITY_VIEW.low

  const onApprove = () => {
    // Optional audited note (mirrors the report/discussion remove-action shape).
    const note = typeof window !== "undefined" ? window.prompt("Note (optional):") : null
    if (note === null && typeof window !== "undefined") return
    approve.mutate(
      { id: item.id, ...(note ? { note } : {}) },
      {
        onSuccess: () => {
          toast(`${item.flag} · approved`)
          onResolved(item.id)
        },
      },
    )
  }

  const onRemove = () => {
    if (typeof window !== "undefined" && !window.confirm(`Remove "${item.flag}"? This takes the content down.`))
      return
    const reason = typeof window !== "undefined" ? window.prompt("Reason for removal (optional):") : null
    if (reason === null && typeof window !== "undefined") return
    remove.mutate(
      { id: item.id, ...(reason ? { reason } : {}) },
      {
        onSuccess: () => {
          toast(`${item.flag} · removed`)
          onResolved(item.id)
        },
      },
    )
  }

  const onHold = () => {
    const note = typeof window !== "undefined" ? window.prompt("Hold note (optional):") : null
    if (note === null && typeof window !== "undefined") return
    hold.mutate(
      { id: item.id, ...(note ? { note } : {}) },
      { onSuccess: () => toast(`${item.flag} · held for review`) },
    )
  }

  const onAppeal = (decision: "uphold" | "overturn") => {
    const note = typeof window !== "undefined" ? window.prompt(`Note for ${decision} (optional):`) : null
    if (note === null && typeof window !== "undefined") return
    appeal.mutate(
      { id: item.id, decision, ...(note ? { note } : {}) },
      {
        onSuccess: () => {
          toast(`${item.flag} · appeal ${decision === "uphold" ? "upheld" : "overturned"}`)
          onResolved(item.id)
        },
      },
    )
  }

  return (
    <div className="rep-detail">
      {/* Header */}
      <div className="rep-head">
        <span className="rep-head-pin">
          {React.createElement(KIND_ICON[item.kind] ?? Icons.Shield, { size: 20 })}
        </span>
        <div className="rep-head-text">
          <div className="crumb">
            {rowKindLabel(item)} · {item.reporter}
            {item.place ? <> · {item.place}</> : null}
          </div>
          <h2>{item.flag}</h2>
        </div>
        <span className={`pill ${priority.cls}`} style={{ marginLeft: "auto" }}>
          <Icons.Flag size={11} /> {priority.label} priority
        </span>
      </div>

      <div className="rep-grid">
        <div className="rep-col">
          {/* Description + reason */}
          <div className="sub">
            <div className="sub-head">Report</div>
            <div className="sub-body">
              <p className="rep-desc">{item.desc}</p>
              <div className="rep-loc">
                <span className="rep-loc-item">
                  <Icons.Flag size={13} /> {item.reason}
                </span>
                {item.place && (
                  <>
                    <span className="rep-loc-sep">·</span>
                    <span className="rep-loc-item">
                      <Icons.Pin size={13} /> {item.place}
                    </span>
                  </>
                )}
              </div>
              {item.autoAction && (
                <div className="rep-city-contact warn" style={{ marginTop: 8 }}>
                  <Icons.AlertTriangle size={12} />
                  <span>{item.autoAction}</span>
                </div>
              )}
            </div>
          </div>

          {/* Media (held photos/videos referenced by the item). */}
          {item.media.length > 0 && (
            <div className="sub">
              <div className="sub-head">Media</div>
              <div className="sub-body" style={{ padding: 10 }}>
                <div className="dsc-msg-media">
                  {item.media.map((m) => {
                    const thumb = m.kind === "image" ? (m.thumbUrl ?? m.url) : m.thumbUrl
                    return (
                      <span key={m.id} className="dsc-msg-thumb">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb} alt="" />
                        ) : (
                          <Icons.FileText size={14} />
                        )}
                      </span>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Signals grid. */}
          {item.signals.length > 0 && (
            <div className="sub">
              <div className="sub-head">Signals</div>
              <div className="sub-body">
                <div className="user-meta-rows">
                  {item.signals.map((s, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <SignalCell key={i} signal={s} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Similar / related items. */}
          {item.similar.length > 0 && (
            <div className="sub">
              <div className="sub-head">Similar items</div>
              <div className="sub-body">
                {item.similar.map((s) => (
                  <div key={s.id} className="prow">
                    <span className="prow-ico hue-lilac">
                      <Icons.Layers size={14} />
                    </span>
                    <div className="prow-body">
                      <div className="prow-title">{s.note}</div>
                      <div className="prow-meta mono">{s.id}</div>
                    </div>
                    <span className="prow-age">{s.when}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rep-col">
          {/* Reporter / user context snapshot. */}
          <div className="sub">
            <div className="sub-head">User context</div>
            <div className="sub-body">
              <div className="user-head">
                <span
                  className="user-av"
                  style={{ background: "linear-gradient(135deg, var(--sky), var(--moss))" }}
                >
                  {item.user.name
                    .split(" ")
                    .map((w) => w[0] ?? "")
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>
                <div>
                  <div className="user-name">{item.user.name}</div>
                  <div className="user-handle mono">{item.user.handle}</div>
                </div>
              </div>
              <div className="user-meta-rows">
                <div className="umr">
                  <span>Joined</span>
                  <span className="mono">{item.user.joined}</span>
                </div>
                <div className="umr">
                  <span>Prior reports</span>
                  <span>{item.user.priorReports}</span>
                </div>
                <div className="umr">
                  <span>Prior removals</span>
                  <span>{item.user.priorRemovals}</span>
                </div>
                <div className="umr">
                  <span>Strikes</span>
                  <span>{item.user.strikes}</span>
                </div>
                <div className="umr">
                  <span>Device</span>
                  <span className="mono">{item.user.device}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar — Approve / Remove / Hold, plus the appeal decision for appeal items. */}
      <div className="rep-actions">
        <span className="rep-actions-label">Decision</span>
        {item.kind === "appeal" ? (
          <>
            <button className="btn sm primary" disabled={busy} onClick={() => onAppeal("overturn")}>
              <Icons.Check size={11} /> Overturn
            </button>
            <button className="btn sm" disabled={busy} onClick={() => onAppeal("uphold")}>
              Uphold
            </button>
          </>
        ) : (
          <button className="btn sm primary" disabled={busy} onClick={onApprove}>
            <Icons.Check size={11} /> Approve
          </button>
        )}
        <button className="btn sm" disabled={busy} onClick={onHold}>
          <Icons.Clock size={11} /> Hold
        </button>
        <div className="spacer" />
        <button className="btn danger" disabled={busy} onClick={onRemove}>
          <Icons.Trash size={13} /> Remove
        </button>
      </div>
    </div>
  )
}

export function ModerationPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<ChipValue>("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  // The "User reports" chip is a CLIENT-SIDE facet: the frozen contract filter union has no `user_report`
  // value, so we fetch `all` and narrow on kind below. Every other chip maps straight to a server filter.
  const serverFilter: ServerFilter | undefined =
    filter === "all" || filter === USER_REPORTS_CHIP ? undefined : filter

  const listParams: ModerationListQuery = {
    ...(serverFilter ? { filter: serverFilter } : {}),
    ...(query.trim() ? { q: query.trim() } : {}),
  }
  const listQuery = useModerationList(listParams)
  const items = React.useMemo(() => {
    const all = listQuery.data?.items ?? []
    return filter === USER_REPORTS_CHIP ? all.filter((x) => x.kind === "user_report") : all
  }, [listQuery.data, filter])

  // Client-side count for the "User reports" chip (the frozen list response carries no per-kind counts).
  const userReportCount = React.useMemo(
    () => (listQuery.data?.items ?? []).filter((x) => x.kind === "user_report").length,
    [listQuery.data],
  )

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.id)
    if (selId && items.length && !items.some((x) => x.id === selId)) setSelId(items[0]!.id)
  }, [items, selId])

  // After an action resolves the item (it clears from the queue) drop the selection so the effect
  // re-selects the first remaining row.
  const onResolved = (id: string) => {
    setSelId((cur) => (cur === id ? null : cur))
  }

  return (
    <>
      <PageHead
        title="Moderation"
        subtitle={
          <span>
            The moderation queue — citizen content reports (the in-app &ldquo;Report&rdquo; button) plus
            held media, coordinated-report clusters, and appeals. Review the signals, then approve,
            remove, hold, or decide the appeal.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={[
            { value: "all", label: "All" },
            { value: USER_REPORTS_CHIP, label: "User reports", count: userReportCount },
            { value: "image", label: "Image" },
            { value: "pattern", label: "Pattern" },
            { value: "appeal", label: "Appeal" },
            { value: "gps", label: "GPS" },
            { value: "duplicate", label: "Duplicate" },
            { value: "high", label: "High" },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as ChipValue)}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            placeholder="Search flag, reporter, reason…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Queue</h3>
            <div className="spacer" />
            <span className="meta">{items.length}</span>
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading queue..." />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                title="Queue is clear"
                sub="Nothing needs review right now."
                icon={<Icons.Shield size={20} />}
              />
            ) : (
              items.map((m) => (
                // Pass the stable setSelId dispatcher (not a fresh arrow) so memoized rows don't all
                // re-render on each parent render; the row calls onSelect(item.id) on click.
                <ModerationRowMemo
                  key={m.id}
                  item={m}
                  selected={selId === m.id}
                  onSelect={setSelId}
                />
              ))
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            <ModerationDetail key={selId} itemId={selId} onResolved={onResolved} />
          ) : (
            <EmptyState
              title="No item selected"
              sub="Pick an item from the queue."
              icon={<Icons.Shield size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

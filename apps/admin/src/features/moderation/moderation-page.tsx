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
import { confirmDialog, promptDialog } from "@/components/shared/dialog"
import { useDebounced } from "@/hooks/use-debounced"
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


type ServerFilter = NonNullable<ModerationListQuery["filter"]>

const USER_REPORTS_CHIP = "user_reports" as const
type ChipValue = "all" | typeof USER_REPORTS_CHIP | ServerFilter

const PRIORITY_VIEW: Record<Priority, { cls: string; label: string }> = {
  low: { cls: "status-new", label: "Low" },
  med: { cls: "status-progress", label: "Med" },
  high: { cls: "status-flag", label: "High" },
}

const TONE_VIEW: Record<ModerationTone, { cls: string }> = {
  ok: { cls: "status-ok" },
  warn: { cls: "status-progress" },
  bad: { cls: "status-flag" },
}

const KIND_ICON: Record<ModerationKind, IconComponent> = {
  image: Icons.Eye,
  pattern: Icons.Activity,
  appeal: Icons.MessageSquare,
  gps: Icons.Pin,
  duplicate: Icons.Copy,
  user_report: Icons.Flag,
}

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
  if (!item)
    return (
      <EmptyState
        title="Item not found"
        sub="This item may already have been resolved."
        icon={<Icons.Shield size={20} />}
      />
    )

  const priority = PRIORITY_VIEW[item.priority] ?? PRIORITY_VIEW.low
  const isUserReport = item.kind === "user_report"

  const onApprove = async () => {
    const note = await promptDialog({
      title: isUserReport ? "Dismiss report" : "Approve",
      label: "Note (optional)",
    })
    if (note === null) return
    approve.mutate(
      { id: item.id, ...(note ? { note } : {}) },
      {
        onSuccess: () => {
          toast(`${item.flag} · ${isUserReport ? "report dismissed" : "approved"}`)
          onResolved(item.id)
        },
      },
    )
  }

  const onRemove = async () => {
    const ok = await confirmDialog({
      title: "Remove content",
      body: "This takes the reported content down.",
      danger: true,
      confirmLabel: "Remove",
    })
    if (!ok) return
    const reason = await promptDialog({
      title: "Remove content",
      label: "Reason (optional)",
    })
    if (reason === null) return
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

  const onHold = async () => {
    const note = await promptDialog({
      title: "Hold for review",
      label: "Note (optional)",
    })
    if (note === null) return
    hold.mutate(
      { id: item.id, ...(note ? { note } : {}) },
      {
        onSuccess: () => {
          toast(`${item.flag} · held for review`)
          onResolved(item.id)
        },
      },
    )
  }

  const onAppeal = async (decision: "uphold" | "overturn") => {
    const note = await promptDialog({
      title: decision === "uphold" ? "Uphold action" : "Overturn action",
      label: "Note (optional)",
    })
    if (note === null) return
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
      { }
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
          { }
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

          { }
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

          { }
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

          { }
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
          { }
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

      { }
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
            <Icons.Check size={11} /> {isUserReport ? "Keep" : "Approve"}
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

  const debouncedQuery = useDebounced(query, 250)

  const serverFilter: ServerFilter | undefined =
    filter === "all" || filter === USER_REPORTS_CHIP ? undefined : filter

  const listParams: ModerationListQuery = {
    ...(serverFilter ? { filter: serverFilter } : {}),
    ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
  }
  const listQuery = useModerationList(listParams)
  const items = React.useMemo(() => {
    const all = listQuery.data?.items ?? []
    return filter === USER_REPORTS_CHIP ? all.filter((x) => x.kind === "user_report") : all
  }, [listQuery.data, filter])

  const allParams: ModerationListQuery = debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}
  const allForCount = useModerationList(allParams)
  const userReportCount = React.useMemo(
    () => (allForCount.data?.items ?? []).filter((x) => x.kind === "user_report").length,
    [allForCount.data],
  )

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.id)
    if (selId && items.length && !items.some((x) => x.id === selId)) setSelId(items[0]!.id)
  }, [items, selId])

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

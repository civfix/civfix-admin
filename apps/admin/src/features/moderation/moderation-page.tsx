"use client"

import * as React from "react"
import {
  MODERATION_KIND_LABELS,
  type GovClaimListQuery,
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
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { LightboxSync, openLightbox, type LightboxImage } from "@/components/shared/lightbox"
import { useDebounced } from "@/hooks/use-debounced"
import { isNotFound } from "@/lib/api"
import { menuFocusIndex } from "@/features/orgs/org-members"
import { getModerationDestination } from "@/features/moderation/moderation-navigation"
import {
  useApproveModeration,
  useAppealModeration,
  useHoldModeration,
  useModerationItem,
  useModerationListInfinite,
  useRemoveModeration,
} from "@/features/moderation/use-moderation"
import { useGovClaimListInfinite } from "@/features/moderation/use-gov-claims"
import { GovClaimDetail, GovClaimRow } from "@/features/moderation/gov-claims-views"
import { useNav } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

type ServerFilter = NonNullable<ModerationListQuery["filter"]>

type Section = "queue" | "gov_claims"
type GovClaimFilter = NonNullable<GovClaimListQuery["filter"]>

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
  post: "post",
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
    <div
      className={`qrow ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={() => onSelect(item.id)}
      onKeyDown={(e) => {
        if (!isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        onSelect(item.id)
      }}
    >
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

// Signals carry no id and the backend does not promise unique labels, so a repeated label is told
// apart by how many times it appeared before.
function signalKey(signals: readonly ModerationSignal[], index: number): string {
  const label = signals[index]!.label
  const earlier = signals.slice(0, index).filter((s) => s.label === label).length
  return `${label}#${earlier}`
}

function ModerationDetail({ itemId, onResolved }: { itemId: string; onResolved: (id: string) => void }) {
  const q = useModerationItem(itemId)
  const nav = useNav()

  const approve = useApproveModeration()
  const remove = useRemoveModeration()
  const hold = useHoldModeration()
  const appeal = useAppealModeration()

  const busy = approve.isPending || remove.isPending || hold.isPending || appeal.isPending

  if (q.isLoading) return <LoadingState label="Loading item..." />
  if (q.isError && !isNotFound(q.error)) {
    return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  }
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
  const destination = getModerationDestination(item.destinationKind, item.destinationId)
  const approveVerb = isUserReport ? "Keep" : "Approve"
  const heldImages: LightboxImage[] = item.media
    .filter((m) => m.kind === "image")
    .map((m, i, images) => ({ id: m.id, url: m.url, alt: `Held image ${i + 1} of ${images.length}` }))
  const heldVideoIds = item.media.filter((m) => m.kind === "video").map((m) => m.id)
  const refreshMedia = () => void q.refetch()

  const onApprove = async () => {
    const note = await promptDialog({
      title: `${approveVerb} ${item.flag}`,
      label: "Note (optional)",
    })
    if (note === null) return
    approve.mutate(
      { request: { id: item.id, ...(note ? { note } : {}) }, item },
      { onSuccess: () => onResolved(item.id) },
    )
  }

  const onRemove = async () => {
    const ok = await confirmDialog({
      title: `Remove ${item.flag}`,
      body: "This takes the reported content down.",
      danger: true,
      confirmLabel: "Remove",
    })
    if (!ok) return
    const reason = await promptDialog({
      title: `Remove ${item.flag}`,
      label: "Reason (optional)",
    })
    if (reason === null) return
    remove.mutate(
      { request: { id: item.id, ...(reason ? { reason } : {}) }, item },
      { onSuccess: () => onResolved(item.id) },
    )
  }

  const onHold = async () => {
    const note = await promptDialog({
      title: `Hold ${item.flag} for review`,
      label: "Note (optional)",
    })
    if (note === null) return
    hold.mutate(
      { request: { id: item.id, ...(note ? { note } : {}) }, item },
      { onSuccess: () => onResolved(item.id) },
    )
  }

  const onAppeal = async (decision: "uphold" | "overturn") => {
    const note = await promptDialog({
      title: decision === "uphold" ? "Uphold action" : "Overturn action",
      label: "Note (optional)",
    })
    if (note === null) return
    appeal.mutate(
      { request: { id: item.id, decision, ...(note ? { note } : {}) }, item },
      { onSuccess: () => onResolved(item.id) },
    )
  }

  return (
    <div className="rep-detail">
      <div className="rep-head">
        <span className="rep-head-pin">
          {React.createElement(KIND_ICON[item.kind] ?? Icons.Shield, { size: 20 })}
        </span>
        <div className="rep-head-text">
          <div className="crumb">
            {rowKindLabel(item)} ·{" "}
            {item.reporterId ? (
              <button
                type="button"
                className="lnk-inline"
                title={`Open ${item.reporter}'s profile`}
                onClick={() => nav("users", item.reporterId!)}
              >
                {item.reporter}
              </button>
            ) : (
              item.reporter
            )}
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
              {item.subjectType && destination && (
                <button
                  type="button"
                  className="btn sm"
                  style={{ marginTop: 10 }}
                  onClick={() => nav(destination.page, destination.id)}
                >
                  <Icons.ExternalLink size={12} /> View reported{" "}
                  {SUBJECT_LABEL[item.subjectType] ?? item.subjectType}
                </button>
              )}
            </div>
          </div>

          {item.media.length > 0 && (
            <div className="sub">
              <div className="sub-head">Media</div>
              <div className="sub-body" style={{ padding: 10 }}>
                <div className="dsc-msg-media">
                  <LightboxSync images={heldImages} />
                  {item.media.map((m) => {
                    if (m.kind === "image") {
                      const index = heldImages.findIndex((img) => img.id === m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className="dsc-msg-thumb dsc-msg-thumb-open"
                          title="Expand this image"
                          onClick={() => openLightbox(heldImages, index, refreshMedia)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.thumbUrl ?? m.url}
                            alt={heldImages[index]?.alt ?? ""}
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      )
                    }
                    return (
                      <a
                        key={m.id}
                        className="dsc-msg-thumb"
                        href={m.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open this video in a new tab"
                        aria-label={`Held video ${heldVideoIds.indexOf(m.id) + 1} of ${heldVideoIds.length}`}
                      >
                        {m.thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.thumbUrl} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <Icons.FileText size={14} />
                        )}
                      </a>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {item.signals.length > 0 && (
            <div className="sub">
              <div className="sub-head">Signals</div>
              <div className="sub-body">
                <div className="user-meta-rows">
                  {item.signals.map((s, i, all) => (
                    <SignalCell key={signalKey(all, i)} signal={s} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {item.similar.length > 0 && (
            <div className="sub">
              <div className="sub-head">Similar items</div>
              <div className="sub-body">
                {item.similar.map((s) => (
                  <div
                    key={s.id}
                    className="prow row-link"
                    role="button"
                    tabIndex={0}
                    title="Open this moderation item"
                    onClick={() => nav("moderation", s.id)}
                    onKeyDown={(e) => {
                      if (!isKeyboardActivationKey(e.key)) return
                      e.preventDefault()
                      nav("moderation", s.id)
                    }}
                  >
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
          <div className="sub">
            <div className="sub-head">User context</div>
            <div className="sub-body">
              {(() => {
                const userId = item.user.id
                const head = (
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
                )
                return userId ? (
                  <div
                    className="row-link"
                    role="button"
                    tabIndex={0}
                    title={`Open ${item.user.name}'s profile`}
                    onClick={() => nav("users", userId)}
                    onKeyDown={(e) => {
                      if (!isKeyboardActivationKey(e.key)) return
                      e.preventDefault()
                      nav("users", userId)
                    }}
                  >
                    {head}
                  </div>
                ) : (
                  head
                )
              })()}
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
            <Icons.Check size={11} /> {approveVerb}
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

function GovClaimsSection() {
  const [filter, setFilter] = React.useState<GovClaimFilter>("pending")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(null)

  const debouncedQuery = useDebounced(query, 250)
  const listParams: GovClaimListQuery = {
    ...(filter === "all" ? {} : { filter }),
    ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
  }
  const listKey = JSON.stringify(listParams)
  const listQuery = useGovClaimListInfinite(listParams)
  const items = React.useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  )

  // Only the first load picks a claim on the operator's behalf. A pick that a filter or search leaves
  // out stays open (the detail reads it by id); a pick that drops out of the same list after a refetch
  // clears, so the pane never jumps to another claim's live Approve and Reject buttons. A decision
  // clears its claim outright, since the list may still hold it (All) or never did. Decided only on
  // data fetched for the current params.
  const [autoPick, setAutoPick] = React.useState(true)
  const seenIn = React.useRef<{ id: string; list: string } | null>(null)
  React.useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isFetching) return
    if (selId === null) {
      if (autoPick && items.length) setSelId(items[0]!.id)
      return
    }
    setAutoPick(false)
    if (items.some((x) => x.id === selId)) seenIn.current = { id: selId, list: listKey }
    else if (seenIn.current?.id === selId && seenIn.current.list === listKey) setSelId(null)
  }, [listQuery.isSuccess, listQuery.isFetching, items, selId, listKey, autoPick])
  const clearIfSelected = (id: string) => setSelId((cur) => (cur === id ? null : cur))

  return (
    <>
      <div className="toolbar">
        <FilterChips
          options={[
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "all", label: "All" },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as GovClaimFilter)}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            aria-label="Search gov claims"
            placeholder="Search name or organization…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Gov claims</h3>
            <div className="spacer" />
            <span className="meta">{items.length}</span>
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading claims..." />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                title="No claims here"
                sub="Nobody is waiting on government access right now."
                icon={<Icons.Building size={20} />}
              />
            ) : (
              <>
                {items.map((c) => (
                  <GovClaimRow
                    key={c.id}
                    item={c}
                    selected={selId === c.id}
                    onSelect={setSelId}
                  />
                ))}
                {listQuery.hasNextPage && (
                  <button
                    type="button"
                    className="btn"
                    style={{ width: "calc(100% - 20px)", margin: "8px 10px" }}
                    disabled={listQuery.isFetchingNextPage}
                    onClick={() => listQuery.fetchNextPage()}
                  >
                    {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            <GovClaimDetail key={selId} claimId={selId} onDecided={clearIfSelected} />
          ) : (
            <EmptyState
              title="No claim selected"
              sub="Pick a claim from the queue."
              icon={<Icons.Building size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

function ModerationQueueSection({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState<"all" | ServerFilter>("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  const debouncedQuery = useDebounced(query, 250)

  const listParams: ModerationListQuery = {
    ...(filter === "all" ? {} : { filter }),
    ...(debouncedQuery.trim() ? { q: debouncedQuery.trim() } : {}),
  }
  const listKey = JSON.stringify(listParams)
  const listQuery = useModerationListInfinite(listParams)
  const items = React.useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  )

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  // Only the first load picks an item on the operator's behalf, and a deep-linked item is never
  // replaced. A pick that a filter or search leaves out stays open (the detail reads it by id); a pick
  // that drops out of the same list after a refetch clears, so the pane never jumps to another item's
  // live decision buttons. A decision clears its item outright: the detail carries no status, so a
  // resolved item the list never held would otherwise keep live buttons. Decided only on data fetched
  // for the current params.
  const [autoPick, setAutoPick] = React.useState(focusId === null)
  const seenIn = React.useRef<{ id: string; list: string } | null>(null)
  React.useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isFetching) return
    if (selId === null) {
      if (autoPick && items.length) setSelId(items[0]!.id)
      return
    }
    setAutoPick(false)
    if (items.some((x) => x.id === selId)) seenIn.current = { id: selId, list: listKey }
    else if (seenIn.current?.id === selId && seenIn.current.list === listKey) setSelId(null)
  }, [listQuery.isSuccess, listQuery.isFetching, items, selId, listKey, autoPick])
  const clearIfSelected = (id: string) => setSelId((cur) => (cur === id ? null : cur))

  return (
    <>
      <div className="toolbar">
        <FilterChips
          options={[
            { value: "all", label: "All" },
            { value: "user_report", label: "User reports" },
            { value: "image", label: "Image" },
            { value: "pattern", label: "Pattern" },
            { value: "appeal", label: "Appeal" },
            { value: "gps", label: "GPS" },
            { value: "duplicate", label: "Duplicate" },
            { value: "high", label: "High" },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as "all" | ServerFilter)}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            aria-label="Search the moderation queue"
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
              <>
                {items.map((m) => (
                  <ModerationRowMemo
                    key={m.id}
                    item={m}
                    selected={selId === m.id}
                    onSelect={setSelId}
                  />
                ))}
                {listQuery.hasNextPage && (
                  <button
                    type="button"
                    className="btn"
                    style={{ width: "calc(100% - 20px)", margin: "8px 10px" }}
                    disabled={listQuery.isFetchingNextPage}
                    onClick={() => listQuery.fetchNextPage()}
                  >
                    {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selId ? (
            <ModerationDetail key={selId} itemId={selId} onResolved={clearIfSelected} />
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

const SECTION_OPTIONS: { id: Section; label: string; Icon: IconComponent }[] = [
  { id: "queue", label: "Queue", Icon: Icons.Shield },
  { id: "gov_claims", label: "Gov claims", Icon: Icons.Building },
]

export function ModerationPage({ focusId }: SectionPageProps) {
  const [section, setSection] = React.useState<Section>("queue")
  const queue = section === "queue"
  const nav = useNav()
  const radioRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  const switchTo = (next: Section) => {
    if (next === section) return
    // The deep link names a queue item; leaving the queue ends it, so coming back opens the queue fresh.
    if (focusId) nav("moderation")
    setSection(next)
  }

  return (
    <>
      <PageHead
        title="Moderation"
        subtitle={
          queue ? (
            <span>
              The moderation queue — citizen content reports (the in-app &ldquo;Report&rdquo; button)
              plus held media, coordinated-report clusters, and appeals. Review the signals, then
              approve, remove, hold, or decide the appeal.
            </span>
          ) : (
            <span>
              Government staff asking for access to their jurisdiction. Verify who they are, then
              approve — which provisions a government role on their account — or reject with a reason.
            </span>
          )
        }
      />

      <div className="mailbox-switch" role="radiogroup" aria-label="Moderation section">
        {SECTION_OPTIONS.map(({ id, label, Icon }, i) => {
          const checked = section === id
          return (
            <button
              key={id}
              ref={(el) => {
                radioRefs.current[i] = el
              }}
              type="button"
              className={`mbx ${checked ? "active" : ""}`}
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => switchTo(id)}
              onKeyDown={(e) => {
                const next = menuFocusIndex(e.key, i, SECTION_OPTIONS.length, "both")
                if (next === null) return
                e.preventDefault()
                switchTo(SECTION_OPTIONS[next]!.id)
                radioRefs.current[next]?.focus()
              }}
            >
              <Icon size={13} /> {label}
            </button>
          )
        })}
      </div>

      {queue ? <ModerationQueueSection focusId={focusId} /> : <GovClaimsSection />}
    </>
  )
}

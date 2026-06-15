"use client"

import * as React from "react"
import {
  MODERATION_KIND_LABELS,
  REPORT_CATEGORY_LABELS,
  type ModerationItemDTO,
  type ModerationListItemDTO,
  type ModerationSignal,
  type ModerationSimilar,
  type Priority,
  type ReportCategory,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
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
 * Moderation queue + detail (ported from data.js moderationQueue[*] + the .mod-detail CSS, enumeration
 * 2.I). This route was a DEAD LINK in the prototype (only ModerationRow + the CSS shipped, no page); it is
 * a first-class master-detail route here: the held-items queue on the left and the full review surface on
 * the right (auto-action banner, media/context by kind, the signals grid, the reporter's trust + priors,
 * and similar items), with the approve / remove / hold actions and uphold / overturn for appeals. All
 * wired to the typed admin client.
 *
 * Items clear from the queue on action: the mutation invalidates the moderation list (which refetches
 * without the resolved item) and we drop the selection so the first remaining row is selected.
 */

/** Per-category hue var for the queue tile + the media placeholder (ported from CAT_HUE). */
function catHue(category: ReportCategory | null): string {
  // "other" + appeals (null category) have no dedicated --cat-* var; use the neutral ink.
  if (!category || category === "other") return "var(--ink-4)"
  return `var(--cat-${category})`
}

function catPinSrc(category: ReportCategory | null): string | null {
  if (!category || category === "other") return null
  return `/ds/pin-${category}.svg`
}

/** Priority pill treatment for the row trailing band. */
const PRIORITY_CLS: Record<Priority, string> = {
  low: "priority-low",
  med: "priority-med",
  high: "priority-high",
}
const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  med: "Med",
  high: "High",
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function categoryLabel(category: ReportCategory | null): string {
  return category ? REPORT_CATEGORY_LABELS[category] : "Appeal"
}

function SignalCell({ s }: { s: ModerationSignal }) {
  return (
    <div className={`signal tone-${s.tone}`}>
      <div className="signal-val">{s.val}</div>
      <div className="signal-label">{s.label}</div>
    </div>
  )
}

function SimilarRow({ s }: { s: ModerationSimilar }) {
  return (
    <div className="similar-row">
      <span className="city mono">{s.id}</span>
      <span className="state">{s.note}</span>
      <span className="reuse">{s.when}</span>
    </div>
  )
}

/** The media / context block: a held image for image/gps kinds, otherwise a text description. */
function ModerationContext({ item }: { item: ModerationItemDTO }) {
  const showPhoto = item.kind === "image" || item.kind === "gps"
  const pin = catPinSrc(item.category)
  if (showPhoto) {
    return (
      <div className="mod-media">
        <div className="mod-photo" style={{ ["--cat" as string]: catHue(item.category) }}>
          <span className="mod-photo-pin" style={{ background: catHue(item.category) }}>
            {pin ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pin} alt="" />
            ) : (
              <Icons.Layers size={20} />
            )}
          </span>
          <span className="mod-photo-flag">
            <Icons.Eye size={11} /> Held media
          </span>
        </div>
        <div className="mod-media-meta">
          <p className="desc">{item.desc}</p>
          {item.place && (
            <div className="row">
              <Icons.Pin size={12} /> {item.place}
            </div>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="mod-textblock">
      <p>{item.desc}</p>
      {item.place && (
        <div className="mod-media-meta">
          <div className="row">
            <Icons.Pin size={12} /> {item.place}
          </div>
        </div>
      )}
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

  if (q.isLoading) return <LoadingState label="Loading item..." />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const item = q.data
  if (!item) {
    return (
      <EmptyState
        title="No item selected"
        sub="Pick an item from the queue."
        icon={<Icons.Shield size={20} />}
      />
    )
  }

  const isAppeal = item.kind === "appeal"
  const acting = approve.isPending || remove.isPending || hold.isPending || appeal.isPending

  const onApprove = () => {
    approve.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          toast(`${item.id} · published`)
          onResolved(item.id)
        },
      },
    )
  }

  const onRemove = () => {
    remove.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          toast(`${item.id} · removed`)
          onResolved(item.id)
        },
      },
    )
  }

  const onHold = () => {
    hold.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          toast(`${item.id} · hold extended`)
          onResolved(item.id)
        },
      },
    )
  }

  const onAppeal = (decision: "uphold" | "overturn") => {
    appeal.mutate(
      { id: item.id, decision },
      {
        onSuccess: () => {
          toast(`${item.id} · appeal ${decision === "uphold" ? "upheld" : "overturned"}`)
          onResolved(item.id)
        },
      },
    )
  }

  const trustVerified = item.user.trust !== "Unverified"

  return (
    <div className="mod-detail">
      <div className="mod-detail-head">
        <div>
          <div className="crumb">
            {item.id} · {MODERATION_KIND_LABELS[item.kind]} · {categoryLabel(item.category)}
          </div>
          <h2>{item.flag}</h2>
        </div>
        <span className={`pill ${PRIORITY_CLS[item.priority]} tight`}>
          {PRIORITY_LABELS[item.priority]}
        </span>
      </div>

      {item.autoAction && (
        <div className="mod-auto">
          <Icons.Clock size={13} /> {item.autoAction}
        </div>
      )}

      <div className="mod-detail-grid">
        <div className="mod-col">
          <div className="sub">
            <div className="sub-head">Context</div>
            <div className="sub-body">
              <ModerationContext item={item} />
            </div>
          </div>

          <div className="sub">
            <div className="sub-head">Signals</div>
            <div className="sub-body">
              {item.signals.length ? (
                <div className="signal-grid">
                  {item.signals.map((s) => (
                    <SignalCell key={s.label} s={s} />
                  ))}
                </div>
              ) : (
                <div className="profile-empty">No signals.</div>
              )}
            </div>
          </div>

          {item.similar.length > 0 && (
            <div className="sub">
              <div className="sub-head">Similar items</div>
              <div className="sub-body">
                <div className="similar-list">
                  {item.similar.map((s) => (
                    <SimilarRow key={s.id} s={s} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mod-col">
          <div className="sub">
            <div className="sub-head">Reported by</div>
            <div className="sub-body">
              <div className="user-head">
                <span
                  className="user-av"
                  style={{
                    background: trustVerified
                      ? "linear-gradient(135deg, var(--sky), var(--moss))"
                      : "var(--ink-4)",
                  }}
                >
                  {initials(item.user.name)}
                </span>
                <div>
                  <div className="user-name">{item.user.name}</div>
                  <div className="user-handle mono">{item.user.handle}</div>
                </div>
              </div>
              <div className={`trust-badge ${trustVerified ? "verified" : "unverified"}`}>
                {trustVerified ? <Icons.Check size={11} /> : <Icons.AlertTriangle size={11} />}
                {item.user.trust}
              </div>
              <div className="user-stats">
                <div className="ustat">
                  <span className="ustat-n">{item.user.priorReports}</span>
                  <span className="ustat-l">Reports</span>
                </div>
                <div className="ustat">
                  <span className={`ustat-n ${item.user.priorRemovals > 0 ? "warn" : ""}`}>
                    {item.user.priorRemovals}
                  </span>
                  <span className="ustat-l">Removals</span>
                </div>
                <div className="ustat">
                  <span className={`ustat-n ${item.user.strikes > 0 ? "bad" : ""}`}>
                    {item.user.strikes}
                  </span>
                  <span className="ustat-l">Strikes</span>
                </div>
              </div>
              <div className="user-meta-rows boxed">
                <div className="umr">
                  <span>Member</span>
                  <span className="mono">{item.user.joined}</span>
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

      <div className="mod-actions">
        <div className="spacer" />
        {isAppeal ? (
          <>
            <button className="btn danger" disabled={acting} onClick={() => onAppeal("uphold")}>
              <Icons.Shield size={13} /> Uphold
            </button>
            <button className="btn primary" disabled={acting} onClick={() => onAppeal("overturn")}>
              <Icons.Check size={13} /> Overturn
            </button>
          </>
        ) : (
          <>
            <button className="btn" disabled={acting} onClick={onHold}>
              <Icons.Clock size={13} /> Hold
            </button>
            <button className="btn danger" disabled={acting} onClick={onRemove}>
              <Icons.Trash size={13} /> Remove
            </button>
            <button className="btn primary" disabled={acting} onClick={onApprove}>
              <Icons.Check size={13} /> Approve
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function ModerationRow({
  item,
  selected,
  onClick,
}: {
  item: ModerationListItemDTO
  selected: boolean
  onClick: () => void
}) {
  return (
    <div className={`qrow ${selected ? "selected" : ""}`} onClick={onClick}>
      <div
        className="leading"
        style={{
          background: catHue(item.category),
          width: 28,
          height: 28,
          borderRadius: 7,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title={categoryLabel(item.category)}
      >
        <Icons.Shield size={13} />
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{item.flag}</span>
          <span className="ident">{item.id}</span>
        </div>
        <div className="sub">
          <span>{item.reporter}</span>
          <span className="sep">·</span>
          <span>{item.reason}</span>
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${PRIORITY_CLS[item.priority]} tight`}>
          {PRIORITY_LABELS[item.priority]}
        </span>
        <span className="age">{item.age}</span>
      </div>
    </div>
  )
}

export function ModerationPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState("all")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)

  // Debounce the search term so a keystroke burst collapses into a single request: `query` drives the
  // controlled input (responsive), but the *deferred* value feeds the query key, so React holds back the
  // param update until typing settles instead of firing GET /admin/moderation on every character.
  const deferredQuery = React.useDeferredValue(query)

  const listParams = {
    filter:
      filter === "all"
        ? undefined
        : (filter as "image" | "pattern" | "appeal" | "gps" | "duplicate" | "high"),
    q: deferredQuery.trim() || undefined,
  }
  const listQuery = useModerationList(listParams)
  const items = React.useMemo(() => listQuery.data?.items ?? [], [listQuery.data])

  // Unfiltered fetch for stable chip counts across filters.
  const allQuery = useModerationList({})
  const allItems = React.useMemo(() => allQuery.data?.items ?? [], [allQuery.data])
  const counts = {
    all: allItems.length,
    image: allItems.filter((m) => m.kind === "image").length,
    pattern: allItems.filter((m) => m.kind === "pattern").length,
    appeal: allItems.filter((m) => m.kind === "appeal").length,
    high: allItems.filter((m) => m.priority === "high").length,
  }

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  React.useEffect(() => {
    if (!selId && items.length) setSelId(items[0]!.id)
    if (selId && items.length && !items.some((x) => x.id === selId)) setSelId(items[0]!.id)
  }, [items, selId])

  // After an action the item clears from the queue; drop the selection so the effect re-selects.
  const onResolved = (id: string) => {
    setSelId((cur) => (cur === id ? null : cur))
  }

  return (
    <>
      <PageHead
        title="Moderation"
        subtitle={
          <span>
            Held media and flagged reports — review the signals, the reporter&apos;s trust, and similar
            items, then approve, remove, or hold.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "image", label: "Image", count: counts.image },
            { value: "pattern", label: "Pattern", count: counts.pattern },
            { value: "appeal", label: "Appeal", count: counts.appeal },
            { value: "high", label: "High", count: counts.high },
          ]}
          value={filter}
          onChange={setFilter}
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
                title="Queue clear"
                sub="Nothing waiting for review."
                icon={<Icons.Shield size={20} />}
              />
            ) : (
              items.map((m) => (
                <ModerationRow
                  key={m.id}
                  item={m}
                  selected={selId === m.id}
                  onClick={() => setSelId(m.id)}
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

"use client"

import * as React from "react"
import type {
  AdminEventPageListItemDTO,
  EventPageStatus,
  EventVisibility,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { PageHead, FilterChips, EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { promptDialog } from "@/components/shared/dialog"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { useDebounced } from "@/hooks/use-debounced"
import { formatDateTime } from "@/lib/dates"
import { EMPTY_VALUE } from "@/lib/empty-value"
import { pageListParams, pageRowFromDTO } from "@/features/pages/pages-filters"
import { publicPagePath } from "@/features/pages/page-path"
import { PagePreview } from "@/features/pages/page-preview"
import {
  useAdminEventPage,
  useEventPagesInfinite,
  useFlagEventPage,
  useUnpublishEventPage,
} from "@/features/pages/use-pages"
import { useNav } from "@/store/ui-store"
import type { SectionPageProps } from "@/components/shell/page-registry"

const PAGE_STATUS_VIEW: Record<EventPageStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "priority-low" },
  published: { label: "Published", cls: "status-ok" },
  unpublished: { label: "Unpublished", cls: "status-flag" },
}

function pageStatusView(status: EventPageStatus): { label: string; cls: string } {
  return Object.hasOwn(PAGE_STATUS_VIEW, status) ? PAGE_STATUS_VIEW[status] : { label: status, cls: "priority-low" }
}

const VISIBILITY_LABEL: Record<EventVisibility, string> = {
  public: "Public",
  unlisted: "Unlisted",
  private: "Private",
}

function PageRow({
  item,
  selected,
  onClick,
}: {
  item: AdminEventPageListItemDTO
  selected: boolean
  onClick: () => void
}) {
  const view = pageStatusView(item.status)
  return (
    <div
      className={`qrow ${selected ? "selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!isKeyboardActivationKey(e.key)) return
        e.preventDefault()
        onClick()
      }}
    >
      <div className="leading">
        <span className="evt-row-ico hue-lilac" title="Signup page">
          <Icons.Globe size={15} />
        </span>
      </div>
      <div className="body">
        <div className="top">
          <span className="title">{item.title}</span>
          {item.flaggedAt && (
            <span className="rep-flag-dot" role="img" aria-label="Flagged" title="Flagged">
              <Icons.Flag size={10} />
            </span>
          )}
          <span className="ident">{item.slug ? publicPagePath(item.slug) : "no slug"}</span>
        </div>
        <div className="sub">
          <span className="strong">{VISIBILITY_LABEL[item.visibility]}</span>
          <span className="sep">·</span>
          <span>{item.viewCount.toLocaleString()} views</span>
          {item.orgName && (
            <>
              <span className="sep">·</span>
              <span>{item.orgName}</span>
            </>
          )}
          {item.organizer && (
            <>
              <span className="sep">·</span>
              <span>{item.organizer.name}</span>
            </>
          )}
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${view.cls} tight`}>{view.label}</span>
        <span className="age">{formatDateTime(item.publishedAt)}</span>
      </div>
    </div>
  )
}

function PageDetail({ item }: { item: AdminEventPageListItemDTO }) {
  const flag = useFlagEventPage()
  const unpublish = useUnpublishEventPage()
  const nav = useNav()
  const view = pageStatusView(item.status)
  const flagged = item.flaggedAt != null

  const onFlag = async () => {
    if (flagged) {
      flag.mutate({ id: item.cleanupId, flagged: false })
      return
    }
    const reason = await promptDialog({
      title: `Flag “${item.title}”?`,
      body: "Flagging marks the page for review without taking it off the public web. The reason is written to the audit log.",
      label: "Reason (required)",
      placeholder: "Fundraising claims that do not match the linked organization…",
      confirmLabel: "Flag page",
      required: true,
    })
    if (reason === null || reason.trim() === "") return
    flag.mutate({ id: item.cleanupId, flagged: true, reason: reason.trim() })
  }

  const onUnpublish = async () => {
    const reason = await promptDialog({
      title: `Unpublish “${item.title}”?`,
      body: "The public page returns a 404 immediately. The event, its roster and every registration are untouched. The reason is written to the audit log.",
      label: "Reason (required)",
      placeholder: "Page impersonates a city agency…",
      confirmLabel: "Unpublish page",
      required: true,
      danger: true,
    })
    if (reason === null || reason.trim() === "") return
    unpublish.mutate({ id: item.cleanupId, reason: reason.trim() })
  }

  return (
    <div className="rep-detail">
      <div className="rep-head">
        <span className="rep-head-pin">
          <span className="evt-head-ico hue-lilac">
            <Icons.Globe size={18} />
          </span>
        </span>
        <div className="rep-head-text">
          <div className="crumb mono">{item.slug ? publicPagePath(item.slug) : "unpublished draft"}</div>
          <h2>{item.title}</h2>
        </div>
        {flagged && (
          <span className="pill status-flag" style={{ marginLeft: "auto" }}>
            <Icons.Flag size={11} /> Flagged
          </span>
        )}
        <span className={`pill ${view.cls}`} style={flagged ? undefined : { marginLeft: "auto" }}>
          {view.label}
        </span>
      </div>

      <div className="sub">
        <div className="sub-head">Page</div>
        <div className="sub-body">
          <div className="user-meta-rows">
            <div className="umr">
              <span>Visibility</span>
              <span>{VISIBILITY_LABEL[item.visibility]}</span>
            </div>
            <div className="umr">
              <span>Views</span>
              <span className="mono">{item.viewCount.toLocaleString()}</span>
            </div>
            <div className="umr">
              <span>Published</span>
              <span>{formatDateTime(item.publishedAt)}</span>
            </div>
            <div className="umr">
              <span>Organization</span>
              <span>{item.orgName ?? EMPTY_VALUE}</span>
            </div>
            <div className="umr">
              <span>Organizer</span>
              <span>{item.organizer?.name ?? EMPTY_VALUE}</span>
            </div>
            {flagged && (
              <div className="umr">
                <span>Flagged</span>
                <span>
                  {formatDateTime(item.flaggedAt)}
                  {item.flaggedBy ? ` · ${item.flaggedBy.name}` : ""}
                </span>
              </div>
            )}
          </div>
          {item.flagReason && (
            <div className="pay-note tone-alert">
              <Icons.Flag size={13} /> {item.flagReason}
            </div>
          )}
          <button className="btn sm ghost full" onClick={() => nav("events", item.cleanupId)}>
            Open the event →
          </button>
        </div>
      </div>

      <div className="sub">
        <div className="sub-head">Rendered content</div>
        <div className="sub-body">
          <PagePreview cleanupId={item.cleanupId} title={item.title} />
        </div>
      </div>

      <div className="rep-actions">
        <span className="rep-actions-label">Moderate</span>
        <div className="spacer" />
        <button
          type="button"
          className={`btn ${flagged ? "flag-on" : ""}`}
          disabled={flag.isPending}
          onClick={() => void onFlag()}
        >
          <Icons.Flag size={13} /> {flagged ? "Clear flag" : "Flag"}
        </button>
        <button
          type="button"
          className="btn danger"
          disabled={unpublish.isPending || item.status === "unpublished"}
          onClick={() => void onUnpublish()}
        >
          <Icons.EyeOff size={13} /> Unpublish
        </button>
      </div>
    </div>
  )
}

export function PagesPage({ focusId }: SectionPageProps) {
  const [filter, setFilter] = React.useState("published")
  const [query, setQuery] = React.useState("")
  const [selId, setSelId] = React.useState<string | null>(focusId)
  const [autoPick, setAutoPick] = React.useState(focusId === null)

  const debouncedQuery = useDebounced(query, 250)
  const listParams = React.useMemo(
    () => pageListParams(filter, debouncedQuery),
    [filter, debouncedQuery],
  )
  const listQuery = useEventPagesInfinite(listParams)
  const items = React.useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [listQuery.data],
  )

  React.useEffect(() => {
    if (focusId) setSelId(focusId)
  }, [focusId])
  // Only the first load picks a page on the operator's behalf, and a deep-linked page is never
  // replaced. A pick that a filter or search leaves out stays open, read by id; a pick that drops out of
  // the same list after a refetch (an unpublish under the Published chip) clears, so the moderation
  // buttons never land on a page nobody chose. Decided only on data fetched for the current params.
  const listKey = JSON.stringify(listParams)
  const seenIn = React.useRef<{ id: string; list: string } | null>(null)
  React.useEffect(() => {
    if (!listQuery.isSuccess || listQuery.isFetching) return
    if (selId === null) {
      if (autoPick && items.length) setSelId(items[0]!.cleanupId)
      return
    }
    setAutoPick(false)
    if (items.some((x) => x.cleanupId === selId)) seenIn.current = { id: selId, list: listKey }
    else if (seenIn.current?.id === selId && seenIn.current.list === listKey) setSelId(null)
  }, [listQuery.isSuccess, listQuery.isFetching, items, selId, listKey, autoPick])

  const listed = items.find((x) => x.cleanupId === selId) ?? null
  // The detail's preview reads the same key, so fetching before the list settles never doubles a request.
  const byId = useAdminEventPage(listed === null ? selId : null)
  const selected = listed ?? (byId.data ? pageRowFromDTO(byId.data) : null)
  const byIdNoun = selId === focusId ? "the linked page" : "the page"

  return (
    <>
      <PageHead
        title="Signup pages"
        subtitle={
          <span>
            The public pages hosts publish for their events. Read what is actually on them, flag what
            needs a second look, and take a page off the web without touching the event.
          </span>
        }
      />

      <div className="toolbar">
        <FilterChips
          options={[
            { value: "all", label: "All" },
            { value: "published", label: "Published" },
            { value: "unpublished", label: "Unpublished" },
            { value: "draft", label: "Draft" },
            { value: "flagged", label: "Flagged" },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div className="toolbar-spacer" />
        <div className="searchbox">
          <Icons.Search size={14} />
          <input
            type="text"
            aria-label="Search signup pages"
            placeholder="Search slug or title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="master-detail">
        <section className="card md-list">
          <div className="card-head">
            <h3>Pages</h3>
            <div className="spacer" />
            {listQuery.isSuccess && (
              <span className="meta">
                {items.length}
                {listQuery.hasNextPage ? "+" : ""}
              </span>
            )}
          </div>
          <div className="queue-list">
            {listQuery.isLoading ? (
              <LoadingState label="Loading pages..." />
            ) : listQuery.isError ? (
              <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
            ) : (
              <>
                {items.length === 0 ? (
                  <EmptyState
                    title="No pages loaded"
                    sub="Nothing on the loaded pages matches this filter or search."
                    icon={<Icons.Globe size={20} />}
                  />
                ) : (
                  items.map((p) => (
                    <PageRow
                      key={p.cleanupId}
                      item={p}
                      selected={selId === p.cleanupId}
                      onClick={() => setSelId(p.cleanupId)}
                    />
                  ))
                )}
                {listQuery.hasNextPage && (
                  <button
                    type="button"
                    className="btn load-more"
                    disabled={listQuery.isFetchingNextPage}
                    onClick={() => void listQuery.fetchNextPage()}
                  >
                    {listQuery.isFetchingNextPage ? "Loading…" : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <section className="card md-detail-card">
          {selected ? (
            <PageDetail key={selected.cleanupId} item={selected} />
          ) : byId.isLoading ? (
            <LoadingState label={`Loading ${byIdNoun}...`} />
          ) : byId.isError ? (
            <ErrorState
              error={byId.error}
              onRetry={() => byId.refetch()}
              title={`Could not load ${byIdNoun}`}
            />
          ) : (
            <EmptyState
              title="No page selected"
              sub="Pick a page from the list."
              icon={<Icons.Globe size={20} />}
            />
          )}
        </section>
      </div>
    </>
  )
}

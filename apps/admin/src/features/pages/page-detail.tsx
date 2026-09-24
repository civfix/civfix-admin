"use client"

import type { AdminEventPageListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { promptReason } from "@/components/shared/dialog"
import { formatDateTime } from "@/lib/dates"
import { EMPTY_VALUE } from "@/lib/empty-value"
import { pageStatusView, VISIBILITY_LABEL } from "@/features/pages/page-labels"
import { publicPagePath } from "@/features/pages/page-path"
import { PagePreview } from "@/features/pages/page-preview"
import { useFlagEventPage, useUnpublishEventPage } from "@/features/pages/use-pages"
import { useNav } from "@/store/ui-store"

function PageDetailHead({ item, flagged }: { item: AdminEventPageListItemDTO; flagged: boolean }) {
  const view = pageStatusView(item.status)
  return (
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
  )
}

function PageFacts({ item, flagged }: { item: AdminEventPageListItemDTO; flagged: boolean }) {
  const nav = useNav()
  return (
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
  )
}

function PageModerationActions({
  item,
  flagged,
}: {
  item: AdminEventPageListItemDTO
  flagged: boolean
}) {
  const flag = useFlagEventPage()
  const unpublish = useUnpublishEventPage()

  const onFlag = async () => {
    if (flagged) {
      flag.mutate({ id: item.cleanupId, flagged: false })
      return
    }
    const reason = await promptReason({
      title: `Flag “${item.title}”?`,
      body: "Flagging marks the page for review without taking it off the public web. The reason is written to the audit log.",
      placeholder: "Fundraising claims that do not match the linked organization…",
      confirmLabel: "Flag page",
    })
    if (reason === null) return
    flag.mutate({ id: item.cleanupId, flagged: true, reason })
  }

  const onUnpublish = async () => {
    const reason = await promptReason({
      title: `Unpublish “${item.title}”?`,
      body: "The public page returns a 404 immediately. The event, its roster and every registration are untouched. The reason is written to the audit log.",
      placeholder: "Page impersonates a city agency…",
      confirmLabel: "Unpublish page",
      danger: true,
    })
    if (reason === null) return
    unpublish.mutate({ id: item.cleanupId, reason })
  }

  return (
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
  )
}

export function PageDetail({ item }: { item: AdminEventPageListItemDTO }) {
  const flagged = item.flaggedAt != null
  return (
    <div className="rep-detail">
      <PageDetailHead item={item} flagged={flagged} />
      <PageFacts item={item} flagged={flagged} />

      <div className="sub">
        <div className="sub-head">Rendered content</div>
        <div className="sub-body">
          <PagePreview cleanupId={item.cleanupId} title={item.title} />
        </div>
      </div>

      <PageModerationActions item={item} flagged={flagged} />
    </div>
  )
}

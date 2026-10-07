"use client"

import type { ModerationItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { isNotFound } from "@/lib/api"
import {
  ModerationDecisionBar,
  useModerationDecisions,
} from "@/features/moderation/moderation-decision-bar"
import {
  HeldMediaCard,
  SignalsCard,
  SimilarItemsCard,
} from "@/features/moderation/moderation-evidence-cards"
import { moderationDestination } from "@/features/moderation/moderation-navigation"
import { UserContextCard } from "@/features/moderation/moderation-user-context"
import { kindIcon, moderationKindLabel, priorityView } from "@/features/moderation/moderation-views"
import { useModerationItem } from "@/features/moderation/use-moderation"
import { useNav } from "@/store/ui-store"

function ModerationHead({ item }: { item: ModerationItemDTO }) {
  const nav = useNav()
  const KindIcon = kindIcon(item.kind)
  const priority = priorityView(item.priority)
  const reporterId = item.reporterId
  return (
    <div className="rep-head">
      <span className="rep-head-pin">
        <KindIcon size={20} />
      </span>
      <div className="rep-head-text">
        <div className="crumb">
          {moderationKindLabel(item)} ·{" "}
          {reporterId ? (
            <button
              type="button"
              className="lnk-inline"
              title={`Open ${item.reporter}'s profile`}
              onClick={() => nav("users", reporterId)}
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
  )
}

function ReportedSubjectCard({ item }: { item: ModerationItemDTO }) {
  const nav = useNav()
  const destination = moderationDestination(item.destinationKind, item.destinationId)
  return (
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
            {item.subjectType}
          </button>
        )}
      </div>
    </div>
  )
}

export function ModerationDetail({
  itemId,
  onResolved,
}: {
  itemId: string
  onResolved: (id: string) => void
}) {
  const itemQuery = useModerationItem(itemId)
  const decisions = useModerationDecisions()

  if (itemQuery.isLoading) return <LoadingState label="Loading item..." />
  if (itemQuery.isError && !isNotFound(itemQuery.error)) {
    return <ErrorState error={itemQuery.error} onRetry={() => itemQuery.refetch()} />
  }
  const item = itemQuery.data
  if (!item)
    return (
      <EmptyState
        title="Item not found"
        sub="This item may already have been resolved."
        icon={<Icons.Shield size={20} />}
      />
    )

  return (
    <div className="rep-detail">
      <ModerationHead item={item} />

      <div className="rep-grid">
        <div className="rep-col">
          <ReportedSubjectCard item={item} />
          <HeldMediaCard media={item.media} refreshMedia={() => void itemQuery.refetch()} />
          <SignalsCard signals={item.signals} />
          <SimilarItemsCard similar={item.similar} />
        </div>

        <div className="rep-col">
          <UserContextCard user={item.user} />
        </div>
      </div>

      <ModerationDecisionBar item={item} decisions={decisions} onResolved={onResolved} />
    </div>
  )
}

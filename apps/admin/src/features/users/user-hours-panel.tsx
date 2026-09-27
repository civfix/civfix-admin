"use client"

import * as React from "react"
import { type AdminUserDTO, type AdminUserHoursEntryDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog, promptDialog } from "@/components/shared/dialog"
import { formatDateTime } from "@/lib/dates"
import { useNav, useToast } from "@/store/ui-store"
import { useUserHours, useVoidUserHours } from "@/features/users/use-user-hours"
import {
  REVOKE_CERTIFICATE_COMMAND,
  affectedCertificateLine,
  formatHours,
  hoursEntryMeta,
  hoursEntryTitle,
  hoursEntryVoidDetail,
  voidedToast,
} from "@/features/users/user-hours"

const VOID_REASON_MAX = 1000

function EntryIcon({ source }: { source: AdminUserHoursEntryDTO["source"] }) {
  if (source === "event") {
    return (
      <span className="prow-ico hue-moss">
        <Icons.Calendar size={14} />
      </span>
    )
  }
  if (source === "manual") {
    return (
      <span className="prow-ico hue-sun">
        <Icons.Clock size={14} />
      </span>
    )
  }
  return (
    <span className="prow-ico hue-slate">
      <Icons.Layers size={14} />
    </span>
  )
}

function HoursEntryRow({
  entry,
  onVoid,
  voiding,
}: {
  entry: AdminUserHoursEntryDTO
  onVoid: (entry: AdminUserHoursEntryDTO) => void
  voiding: boolean
}) {
  const nav = useNav()
  const voided = entry.voidedAt !== null
  const voidDetail = hoursEntryVoidDetail(entry)
  const event = entry.source === "event" ? entry.event : null
  const content = (
    <>
      <EntryIcon source={entry.source} />
      <div className="prow-body">
        <div className="prow-title">
          {voided && (
            <span className="pill status-flag tight" title={formatDateTime(entry.voidedAt)}>
              Voided
            </span>
          )}{" "}
          {hoursEntryTitle(entry)}
        </div>
        <div className="prow-meta">{hoursEntryMeta(entry).join(" · ")}</div>
        {entry.note && <div className="prow-meta prow-note">{entry.note}</div>}
        {voidDetail && <div className="prow-meta prow-note">{voidDetail}</div>}
      </div>
    </>
  )
  return (
    <div className={`prow ${voided ? "removed" : ""}`}>
      {event ? (
        <button
          type="button"
          className="prow-main row-link"
          onClick={() => nav("events", event.id)}
          title="Open event"
        >
          {content}
        </button>
      ) : (
        <div className="prow-main">{content}</div>
      )}
      <span className="prow-hours">{formatHours(entry.hours)} h</span>
      {entry.voidable && (
        <button
          type="button"
          className="btn sm danger"
          disabled={voiding}
          onClick={() => onVoid(entry)}
          title="Void this entry (it stops counting and stays here marked Voided)"
        >
          <Icons.X size={11} /> Void
        </button>
      )}
    </div>
  )
}

export function UserHoursPanel({ user }: { user: AdminUserDTO }) {
  const q = useUserHours(user.id)
  const voidHours = useVoidUserHours()
  const toast = useToast()
  // Guards a second click while the reason prompt is already open.
  const prompting = React.useRef(false)

  const onVoid = async (entry: AdminUserHoursEntryDTO) => {
    if (prompting.current || voidHours.isPending) return
    prompting.current = true
    let reason: string | null
    try {
      reason = await promptDialog({
        title: `Void ${formatHours(entry.hours)} h — ${hoursEntryTitle(entry)}`,
        body: "The entry stops counting toward this neighbor's total and stays on this ledger marked Voided. The neighbor is not notified.",
        label: "Reason (required)",
        required: true,
        danger: true,
        confirmLabel: "Void entry",
        maxLength: VOID_REASON_MAX,
      })
    } finally {
      prompting.current = false
    }
    if (reason === null) return
    voidHours.mutate(
      { id: user.id, entryId: entry.id, reason: reason.trim(), eventId: entry.event?.id ?? null },
      {
        onSuccess: (res) => {
          toast(voidedToast(user.name, entry.hours))
          if (res.affectedCertificates.length === 0) return
          void confirmDialog({
            title: "Issued transcripts still list this entry",
            body: `These transcripts still verify with the old total until they are revoked. Revoke each one from the backend with: ${REVOKE_CERTIFICATE_COMMAND}`,
            details: res.affectedCertificates.map(affectedCertificateLine),
            confirmLabel: "Done",
            acknowledgeOnly: true,
          })
        },
      },
    )
  }

  if (q.isLoading) {
    return (
      <div className="profile-list">
        <LoadingState label="Loading hours..." />
      </div>
    )
  }
  if (q.isError) {
    return (
      <div className="profile-list">
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </div>
    )
  }

  const pages = q.data?.pages ?? []
  const items = pages.flatMap((p) => p.items)
  const totals = pages[0]?.totals

  return (
    <>
      {totals && (
        <div className="user-stats user-hours-stats">
          <div className="ustat">
            <span className="ustat-n">{formatHours(totals.totalHours)}</span>
            <span className="ustat-l">Total hours</span>
          </div>
          <div className="ustat">
            <span className="ustat-n">{totals.liveEntries.toLocaleString()}</span>
            <span className="ustat-l">Entries</span>
          </div>
          <div className="ustat">
            <span className="ustat-n">{totals.voidedEntries.toLocaleString()}</span>
            <span className="ustat-l">Voided</span>
          </div>
        </div>
      )}
      <div className="profile-list">
        {items.length === 0 ? (
          <EmptyState
            title="No hours yet"
            sub="This neighbor has no volunteer hours on record."
            icon={<Icons.Clock size={20} />}
          />
        ) : (
          <>
            {items.map((entry) => (
              <HoursEntryRow
                key={entry.id}
                entry={entry}
                onVoid={(e) => void onVoid(e)}
                voiding={voidHours.isPending}
              />
            ))}
            {q.hasNextPage && (
              <button
                type="button"
                className="btn load-more"
                disabled={q.isFetchingNextPage}
                onClick={() => void q.fetchNextPage()}
              >
                {q.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        )}
      </div>
    </>
  )
}

"use client"

import * as React from "react"
import { MAX_EVENT_HOURS, MIN_EVENT_HOURS, type AdminUserDTO, type AdminUserHoursEntryDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { EmptyState } from "@/components/shared/page-primitives"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog, promptDialog } from "@/components/shared/dialog"
import { formatDateTime } from "@/lib/dates"
import { useNav } from "@/store/ui-store"
import { FieldError, ReasonField, fieldErrorId } from "@/features/orgs/org-form-fields"
import { EventPicker } from "@/features/users/event-picker"
import {
  useCreditUserHours,
  useUserHours,
  useVoidUserHours,
} from "@/features/users/use-user-hours"
import {
  buildCreditRequest,
  creditBlockedReason,
  creditConfirmBody,
  creditConfirmTitle,
  creditDraftErrors,
  creditServerErrors,
  formatHours,
  hoursEntryMeta,
  hoursEntryTitle,
  hoursEntryVoidDetail,
  todayLocalIsoDate,
  type CreditHoursDraft,
  type CreditHoursErrors,
  type CreditKind,
} from "@/features/users/user-hours"

const VOID_REASON_MAX = 1000
const CREDIT_KINDS: readonly { kind: CreditKind; label: string }[] = [
  { kind: "event", label: "Event credit" },
  { kind: "manual", label: "Manual adjustment" },
]

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
    <div className={`prow ledger-row ${voided ? "removed" : ""}`}>
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

function CreditHoursForm({ user, onDone }: { user: AdminUserDTO; onDone: () => void }) {
  const credit = useCreditUserHours()
  const [draft, setDraft] = React.useState<CreditHoursDraft>(() => ({
    kind: "event",
    event: null,
    hours: "",
    serviceDate: todayLocalIsoDate(),
    reason: "",
  }))
  const [attempted, setAttempted] = React.useState(false)
  const [serverErrors, setServerErrors] = React.useState<CreditHoursErrors>({})
  // Guards a second Enter while the confirmation is open.
  const confirming = React.useRef(false)
  const mounted = React.useRef(true)
  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const today = todayLocalIsoDate()
  const pending = credit.isPending
  const errors: CreditHoursErrors = {
    ...serverErrors,
    ...(attempted ? creditDraftErrors(draft, today) : {}),
  }
  const change = (patch: Partial<CreditHoursDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
    setServerErrors({})
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (confirming.current || credit.isPending) return
    setAttempted(true)
    const request = buildCreditRequest(user.id, draft, today)
    if (!request) return
    confirming.current = true
    let ok: boolean
    try {
      ok = await confirmDialog({
        title: creditConfirmTitle(user.name, request, draft.event?.title ?? null),
        body: creditConfirmBody(user.name, request.kind),
        confirmLabel: "Credit hours",
      })
    } finally {
      confirming.current = false
    }
    if (!ok) return
    setServerErrors({})
    credit.mutate(
      { request, userName: user.name, showsErrorInline: () => mounted.current },
      {
        onSuccess: onDone,
        onError: (err) => setServerErrors(creditServerErrors(err)),
      },
    )
  }

  return (
    <form className="sub user-hours-credit" noValidate onSubmit={(e) => void submit(e)}>
      <div className="sub-head">Credit hours</div>
      <div className="sub-body">
        <div className="field">
          <span className="lbl" id="user-hours-kind">
            Credit type
          </span>
          <div className="seg" role="group" aria-labelledby="user-hours-kind">
            {CREDIT_KINDS.map(({ kind, label }) => (
              <button
                key={kind}
                type="button"
                className={`seg-btn ${draft.kind === kind ? "active" : ""}`}
                aria-pressed={draft.kind === kind}
                disabled={pending}
                onClick={() => change({ kind })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {draft.kind === "event" ? (
          <div className={`field ${errors.event ? "has-error" : ""}`}>
            <span className="lbl">Event</span>
            <EventPicker
              value={draft.event}
              onChange={(event) => change({ event })}
              disabled={pending}
            />
            {errors.event ? (
              <FieldError id={fieldErrorId("user-hours-event")} text={errors.event} />
            ) : (
              <span className="hint">
                Only events that have ended can be credited. Each credit is at most the
                event&apos;s length plus one hour, and a person gets at most 24 h per day.
              </span>
            )}
          </div>
        ) : (
          <div className={`field ${errors.serviceDate ? "has-error" : ""}`}>
            <label className="lbl" htmlFor="user-hours-date">
              Date of service
            </label>
            <input
              id="user-hours-date"
              type="date"
              className="user-hours-date"
              value={draft.serviceDate}
              max={today}
              required
              disabled={pending}
              onChange={(e) => change({ serviceDate: e.target.value })}
            />
            {errors.serviceDate ? (
              <FieldError id={fieldErrorId("user-hours-date")} text={errors.serviceDate} />
            ) : (
              <span className="hint">
                Counts toward the neighbor&apos;s total but toward no jurisdiction&apos;s
                leaderboard. A person gets at most 24 h per day.
              </span>
            )}
          </div>
        )}

        <div className={`field ${errors.hours ? "has-error" : ""}`}>
          <label className="lbl" htmlFor="user-hours-amount">
            Hours
          </label>
          <input
            id="user-hours-amount"
            type="number"
            inputMode="decimal"
            className="user-hours-amount"
            step="any"
            min={MIN_EVENT_HOURS}
            max={MAX_EVENT_HOURS}
            value={draft.hours}
            placeholder="2.5"
            disabled={pending}
            onChange={(e) => change({ hours: e.target.value })}
          />
          <FieldError id={fieldErrorId("user-hours-amount")} text={errors.hours} />
        </div>

        <ReasonField
          id="user-hours-reason"
          value={draft.reason}
          onChange={(reason) => change({ reason })}
          error={errors.reason}
          placeholder="Attended before signing up; confirmed on the host's paper sign-in sheet…"
          disabled={pending}
        />

        <FieldError id={fieldErrorId("user-hours-form")} text={errors.form} />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onDone} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={pending}>
            <Icons.Plus size={13} /> {pending ? "Crediting…" : "Credit hours"}
          </button>
        </div>
      </div>
    </form>
  )
}

export function UserHoursPanel({ user }: { user: AdminUserDTO }) {
  const q = useUserHours(user.id)
  const voidHours = useVoidUserHours()
  const [crediting, setCrediting] = React.useState(false)
  const creditBlocked = creditBlockedReason(user)
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
    voidHours.mutate({
      id: user.id,
      entryId: entry.id,
      reason: reason.trim(),
      eventId: entry.event?.id ?? null,
      userName: user.name,
      hours: entry.hours,
    })
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
      {crediting ? (
        <CreditHoursForm user={user} onDone={() => setCrediting(false)} />
      ) : (
        <div className="user-hours-head">
          {creditBlocked && <span className="hint">{creditBlocked}</span>}
          <button
            type="button"
            className="btn sm ghost"
            disabled={creditBlocked !== null}
            onClick={() => setCrediting(true)}
          >
            <Icons.Plus size={12} /> Credit hours
          </button>
        </div>
      )}
      <div className="profile-list">
        {q.isLoading ? (
          <LoadingState label="Loading hours..." />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
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

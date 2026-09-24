"use client"

import * as React from "react"
import type { AdminEventDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { parseBags } from "@/features/events/event-outcome"
import { turnoutLabel, turnoutPercent } from "@/features/events/event-turnout"
import { useSetEventOutcome } from "@/features/events/use-events"

function TurnoutMeter({ event }: { event: AdminEventDTO }) {
  const percent = turnoutPercent(event.attendees, event.capacity)
  return (
    <div className="evt-turnout" style={event.status === "cancelled" ? { opacity: 0.6 } : undefined}>
      <div className="evt-turnout-top">
        <span className="evt-turnout-n">
          {event.attendees}
          {event.capacity != null && <span className="evt-turnout-cap"> / {event.capacity}</span>}
        </span>
        <span className="evt-turnout-lbl">{turnoutLabel(event.status)}</span>
      </div>
      {event.capacity != null && (
        <div className="evt-turnout-bar">
          <span style={{ width: percent + "%" }} />
        </div>
      )}
    </div>
  )
}

function BagsCollected({ event }: { event: AdminEventDTO }) {
  if (event.bags > 0) {
    return (
      <div className="evt-stat-row">
        <span className="evt-stat">
          <Icons.Trash size={13} /> <b>{event.bags}</b> {event.bags === 1 ? "bag" : "bags"} collected
        </span>
      </div>
    )
  }
  if (event.status !== "completed") return null
  return (
    <div className="evt-stat-row">
      <span className="evt-stat">
        <Icons.Trash size={13} /> No outcome logged
      </span>
    </div>
  )
}

function OutcomeForm({
  hasOutcome,
  bagsInput,
  onBagsInputChange,
  submitDisabled,
  onSubmit,
}: {
  hasOutcome: boolean
  bagsInput: string
  onBagsInputChange: (value: string) => void
  submitDisabled: boolean
  onSubmit: () => void
}) {
  return (
    <div className="evt-stat-row" style={{ gap: 8, alignItems: "center", marginTop: 6 }}>
      <input
        type="number"
        min={0}
        step={1}
        placeholder="bags"
        aria-label="Bags collected"
        value={bagsInput}
        onChange={(e) => onBagsInputChange(e.target.value)}
        style={{ width: 84 }}
      />
      <button className="btn sm" disabled={submitDisabled} onClick={onSubmit}>
        {hasOutcome ? "Update outcome" : "Log outcome"}
      </button>
    </div>
  )
}

export function useOutcomeDraft() {
  const outcomeMutation = useSetEventOutcome()
  const [bagsInput, setBagsInput] = React.useState("")
  return { outcomeMutation, bagsInput, setBagsInput }
}

export function EventTurnoutCard({
  event,
  outcome,
}: {
  event: AdminEventDTO
  outcome: ReturnType<typeof useOutcomeDraft>
}) {
  const { outcomeMutation, bagsInput, setBagsInput } = outcome
  const bags = parseBags(bagsInput)
  const canLogOutcome = event.status === "in_progress" || event.status === "completed"

  const logOutcome = () => {
    if (bags === null) return
    outcomeMutation.mutate({ id: event.id, bags }, { onSuccess: () => setBagsInput("") })
  }

  return (
    <div className="sub">
      <div className="sub-head">Turnout</div>
      <div className="sub-body">
        <TurnoutMeter event={event} />
        <BagsCollected event={event} />
        {canLogOutcome && (
          <OutcomeForm
            hasOutcome={event.bags > 0}
            bagsInput={bagsInput}
            onBagsInputChange={setBagsInput}
            submitDisabled={outcomeMutation.isPending || bags === null}
            onSubmit={logOutcome}
          />
        )}
      </div>
    </div>
  )
}

"use client"

import * as React from "react"
import {
  RUNTIME_FLAGS,
  type RuntimeFlagDef,
  type RuntimeFlagStateDTO,
  type RuntimeFlagValue,
} from "@civfix/contract"

import { ErrorState, LoadingState } from "@/components/shared/data-states"
import { useNow } from "@/hooks/use-now"
import { errorMessage } from "@/lib/error-messages"
import { FieldError, fieldErrorId } from "@/features/orgs/org-form-fields"
import { useDevConfirm } from "@/features/dev/dev-confirm"
import { Ago, NOT_SET } from "@/features/dev/dev-format"
import { Fields } from "@/features/dev/overview-tab"
import { isValidationError, useRuntimeFlags, useSetRuntimeFlag } from "@/features/dev/use-dev-flags"

const FLAG_DEFS = new Map<string, RuntimeFlagDef>(RUNTIME_FLAGS.map((def) => [def.key, def]))

// A minimum version above a phone's own locks that phone out until it updates.
const MIN_VERSION_KEYS: ReadonlySet<string> = new Set(["min_app_version_ios", "min_app_version_android"])
const MIN_VERSION_WARNING = "Phones below this version can't use civfix until they update."

type TextFlagDef = Extract<RuntimeFlagDef, { type: "semver" | "url" | "text" }>

function isTextFlag(def: RuntimeFlagDef): def is TextFlagDef {
  return def.type === "semver" || def.type === "url" || def.type === "text"
}

function shownValue(def: RuntimeFlagDef, value: RuntimeFlagValue): string {
  if (value === true) return "On"
  if (value === false) return "Off"
  if (value === null) return NOT_SET
  if (def.type === "choice") return def.choices.find((choice) => choice.value === value)?.label ?? value
  return value
}

function sourceLabel(state: RuntimeFlagStateDTO): string {
  if (state.override !== null) return "Override"
  return state.fallbackSource === "env" ? "From env" : "Default"
}

function FlagFacts({ def, state, now }: { def: RuntimeFlagDef; state: RuntimeFlagStateDTO; now: number }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Value", value: shownValue(def, state.value) },
    { label: "Source", value: sourceLabel(state) },
  ]
  if (state.override !== null) {
    rows.push({ label: "Fallback", value: shownValue(def, state.fallback) })
    if (state.updatedBy) rows.push({ label: "Changed by", value: state.updatedBy.email })
    if (state.updatedAt) rows.push({ label: "Changed", value: <Ago value={state.updatedAt} now={now} /> })
  }
  return <Fields rows={rows} />
}

function TextFlagField({
  def,
  state,
  labelledBy,
  busy,
  error,
  onSave,
}: {
  def: TextFlagDef
  state: RuntimeFlagStateDTO
  labelledBy: string
  busy: boolean
  error: string | null
  onSave: (value: string | null) => void
}) {
  const fieldId = React.useId()
  const hintId = `${fieldId}-hint`
  const saved = typeof state.value === "string" ? state.value : ""
  const [draft, setDraft] = React.useState(saved)
  const next = draft.trim()

  let hint: string | null = null
  if (def.type === "text") hint = `${draft.length}/${def.maxLength}`
  else if (def.type === "url") hint = `Starts with ${def.urlPrefix}`

  let describedBy: string | undefined
  if (error) describedBy = fieldErrorId(fieldId)
  else if (hint) describedBy = hintId

  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <div className="row-flex">
        <input
          id={fieldId}
          type="text"
          value={draft}
          maxLength={def.type === "text" ? def.maxLength : undefined}
          disabled={busy}
          aria-labelledby={labelledBy}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          className="btn sm"
          disabled={busy || next === saved}
          onClick={() => onSave(next === "" ? null : next)}
        >
          Save
        </button>
      </div>
      {hint && (
        <span id={hintId} className="hint mono">
          {hint}
        </span>
      )}
      <FieldError id={fieldErrorId(fieldId)} text={error} />
    </div>
  )
}

function FlagCard({ def, state, now }: { def: RuntimeFlagDef; state: RuntimeFlagStateDTO; now: number }) {
  const headingId = React.useId()
  const setFlag = useSetRuntimeFlag({ fieldErrors: isTextFlag(def) })
  const confirm = useDevConfirm()
  const busy = setFlag.isPending

  /** `next` is the value the flag will have; `value` is what is sent (null clears the override). */
  const change = async (title: string, next: RuntimeFlagValue, value: RuntimeFlagValue) => {
    const ok = await confirm({
      title,
      body: MIN_VERSION_KEYS.has(def.key) && next !== null ? MIN_VERSION_WARNING : undefined,
      details: [shownValue(def, state.value), shownValue(def, next)],
      verb: "Change",
    })
    if (ok) setFlag.mutate({ key: def.key, value })
  }
  const changeTo = (value: RuntimeFlagValue) =>
    void change(`Change ${def.label} to ${value === null ? "not set" : shownValue(def, value)}?`, value, value)

  let editor: React.ReactNode
  if (def.type === "boolean") {
    const on = state.value === true
    editor = (
      <button
        type="button"
        role="switch"
        className="dev-switch"
        aria-checked={on}
        aria-labelledby={headingId}
        disabled={busy}
        onClick={() => void change(`Turn ${on ? "off" : "on"} ${def.label}?`, !on, !on)}
      />
    )
  } else if (def.type === "choice") {
    editor = (
      <div className="field">
        <select
          value={typeof state.value === "string" ? state.value : def.default}
          aria-labelledby={headingId}
          disabled={busy}
          onChange={(e) => changeTo(e.target.value)}
        >
          {def.choices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </div>
    )
  } else {
    const refused = setFlag.isError && isValidationError(setFlag.error) ? errorMessage(setFlag.error) : null
    editor = (
      <TextFlagField
        // A saved change remounts the field, so it starts again from the new value.
        key={String(state.value)}
        def={def}
        state={state}
        labelledBy={headingId}
        busy={busy}
        error={refused}
        onSave={changeTo}
      />
    )
  }

  return (
    <section className="card" aria-labelledby={headingId}>
      <div className="card-head">
        <h3 id={headingId}>{def.label}</h3>
        <span className="spacer" />
        {state.override !== null && (
          <button
            type="button"
            className="head-action"
            disabled={busy}
            onClick={() =>
              void change(
                `Clear the override for ${def.label}? It goes back to ${shownValue(def, state.fallback)}.`,
                state.fallback,
                null,
              )
            }
          >
            Clear override
          </button>
        )}
      </div>
      <div className="card-pad dev-stack">
        <p className="muted">{def.description}</p>
        <FlagFacts def={def} state={state} now={now} />
        {editor}
      </div>
    </section>
  )
}

export function FlagsTab() {
  const flags = useRuntimeFlags()
  const now = useNow()

  const failure = flags.isError && <ErrorState error={flags.error} onRetry={() => void flags.refetch()} />
  if (!flags.data) return failure || <LoadingState label="Loading flags..." />

  return (
    <>
      {/* A failed refresh keeps the last flags on screen under its message. */}
      {failure}
      <div className="dev-grid">
        {flags.data.flags.map((state) => {
          // The API lists the same registry; a key this build doesn't know has no label or editor.
          const def = FLAG_DEFS.get(state.key)
          return def && <FlagCard key={state.key} def={def} state={state} now={now} />
        })}
      </div>
    </>
  )
}

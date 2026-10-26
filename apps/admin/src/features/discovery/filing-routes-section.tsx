"use client"

import * as React from "react"
import {
  FILING_REQUEST_TYPE_HINT_MAX,
  FILING_SENDER_DOMAINS_MAX,
  type FilingRouteHealth,
  type JurisdictionDirectoryDTO,
} from "@civfix/contract"

import { Icons } from "@/components/icons"
import { ErrorState, LoadingState } from "@/components/shared/data-states"
import {
  CHANNEL_OPTIONS,
  HEALTH_SEPARATOR,
  NEVER_USED,
  ROUTES_FALLBACK_HINT,
  healthParts,
  parseRows,
  routeRows,
  rowErrorsFromError,
  withChannel,
  type RouteChannelChoice,
  type RouteRow,
  type RouteRowErrors,
  type RouteRowKey,
} from "@/features/discovery/filing-routes-model"
import { useFilingRoutes, useSaveFilingRoutes } from "@/features/discovery/use-filing-routes"
import { useNow } from "@/hooks/use-now"
import { categoryPinSrc } from "@/lib/category"
import { formatAgo, preciseDateTimeTitle } from "@/lib/dates"

function withoutKey(errors: RouteRowErrors, key: RouteRowKey): RouteRowErrors {
  if (errors[key] === undefined) return errors
  const { [key]: _cleared, ...rest } = errors
  return rest
}

export function FilingRoutesSection({ dto }: { dto: JurisdictionDirectoryDTO }) {
  const routes = useFilingRoutes(dto.geoid)
  const save = useSaveFilingRoutes()
  const now = useNow()
  // Unsaved edits, or null to follow the saved list. Every Save draft and Save & route refetches the
  // routes, so only a successful Save routes may drop them.
  const [edits, setEdits] = React.useState<RouteRow[] | null>(null)
  const [rowErrors, setRowErrors] = React.useState<RouteRowErrors>({})
  const [generalError, setGeneralError] = React.useState<string | null>(null)
  const saved = React.useMemo(() => (routes.data ? routeRows(routes.data.routes) : null), [routes.data])
  const rows = edits ?? saved

  const updateRow = (key: RouteRowKey, change: (row: RouteRow) => RouteRow) => {
    setEdits((prev) => (prev ?? saved)?.map((row) => (row.key === key ? change(row) : row)) ?? null)
    // The operator is fixing this row, so its stale message must not stick to it.
    setRowErrors((prev) => withoutKey(prev, key))
  }

  const saveRoutes = () => {
    if (!rows) return
    const parsed = parseRows(rows)
    setGeneralError(null)
    setRowErrors(parsed.rowErrors)
    if (Object.keys(parsed.rowErrors).length > 0) return
    save.mutate(
      { geoid: dto.geoid, routes: parsed.routes },
      {
        onSuccess: () => setEdits(null),
        onError: (error) => {
          const mapped = rowErrorsFromError(error, parsed.sentKeys)
          setRowErrors(mapped.rows)
          setGeneralError(mapped.general)
        },
      },
    )
  }

  return (
    <div className="sub">
      <div className="sub-head">Filing routes</div>
      <div className="sub-body">
        {rows ? (
          <>
            <div className="ccat-grid one-col">
              {rows.map((row) => (
                <RouteRowCell
                  key={row.key}
                  row={row}
                  error={rowErrors[row.key] ?? null}
                  now={now}
                  onChannel={(channel) => updateRow(row.key, (r) => withChannel(r, channel, dto.form))}
                  onChange={(patch) => updateRow(row.key, (r) => ({ ...r, ...patch }))}
                />
              ))}
            </div>
            <div className="hint" style={{ marginTop: "var(--space-3)" }}>
              {ROUTES_FALLBACK_HINT}
            </div>
            {generalError && (
              <span className="field-error" role="alert" style={{ marginTop: "var(--space-3)" }}>
                <Icons.AlertTriangle size={11} /> {generalError}
              </span>
            )}
            <div className="tpl-state" style={{ marginTop: "var(--space-3)" }}>
              <div className="spacer" />
              <button type="button" className="btn primary" disabled={save.isPending} onClick={saveRoutes}>
                Save routes
              </button>
            </div>
          </>
        ) : routes.isError ? (
          <ErrorState
            error={routes.error}
            title="Could not load the filing routes"
            action={{ label: "Retry", onClick: () => void routes.refetch() }}
          />
        ) : (
          <LoadingState label="Loading filing routes…" />
        )}
      </div>
    </div>
  )
}

function RouteRowCell({
  row,
  error,
  now,
  onChannel,
  onChange,
}: {
  row: RouteRow
  error: string | null
  now: number
  onChannel: (channel: RouteChannelChoice) => void
  onChange: (patch: Partial<RouteRow>) => void
}) {
  const id = React.useId()
  return (
    <div
      role="group"
      aria-label={`${row.label} route`}
      className={`ccat-cell ${row.channel === "none" ? "quiet" : ""}`}
    >
      <div className="ccat-cell-head">
        <span className="ccat-pin">
          {row.key === "default" ? <Icons.Layers size={16} /> : <img src={categoryPinSrc(row.key)} alt="" />}
        </span>
        <span className="ccat-label">{row.label}</span>
      </div>

      <div className="field">
        <label className="lbl" htmlFor={`${id}-channel`}>
          Channel
        </label>
        <select
          id={`${id}-channel`}
          value={row.channel}
          onChange={(e) => onChannel(e.target.value as RouteChannelChoice)}
        >
          {CHANNEL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {row.channel === "portal" && (
        <>
          <div className="field">
            <label className="lbl" htmlFor={`${id}-url`}>
              Start URL
            </label>
            <input
              id={`${id}-url`}
              type="url"
              value={row.formUrl}
              placeholder="e.g. https://city.gov/report"
              onChange={(e) => onChange({ formUrl: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="lbl" htmlFor={`${id}-hint`}>
              Request type hint
            </label>
            <input
              id={`${id}-hint`}
              type="text"
              value={row.requestTypeHint}
              maxLength={FILING_REQUEST_TYPE_HINT_MAX}
              placeholder="e.g. Graffiti Removal"
              onChange={(e) => onChange({ requestTypeHint: e.target.value })}
            />
          </div>
        </>
      )}

      <SenderChips senders={row.senders} inputId={`${id}-senders`} onChange={(senders) => onChange({ senders })} />

      <div className="row-flex">
        <label className="row-flex">
          <input
            type="checkbox"
            checked={row.includeLink}
            onChange={(e) => onChange({ includeLink: e.target.checked })}
          />
          Include CivFix link
        </label>
        <label className="row-flex">
          <input type="checkbox" checked={row.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
          Enabled
        </label>
      </div>

      {row.health && (
        <div className="sub-caption">
          <HealthLine health={row.health} now={now} />
        </div>
      )}

      {error && (
        <span className="field-error" role="alert">
          <Icons.AlertTriangle size={11} /> {error}
        </span>
      )}
    </div>
  )
}

function SenderChips({
  senders,
  inputId,
  onChange,
}: {
  senders: string[]
  inputId: string
  onChange: (senders: string[]) => void
}) {
  const [text, setText] = React.useState("")
  const full = senders.length >= FILING_SENDER_DOMAINS_MAX
  const add = () => {
    const domain = text.trim()
    if (full || domain === "") return
    if (!senders.includes(domain)) onChange([...senders, domain])
    setText("")
  }
  return (
    <div className="field">
      <label className="lbl" htmlFor={inputId}>
        City email senders
      </label>
      {senders.length > 0 && (
        <div className="filter-chips">
          {senders.map((domain) => (
            <span key={domain} className="fchip">
              {domain}
              <button
                type="button"
                className="btn sm ghost"
                aria-label={`Remove ${domain}`}
                onClick={() => onChange(senders.filter((d) => d !== domain))}
              >
                <Icons.X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="row-flex">
        <input
          id={inputId}
          type="text"
          value={text}
          disabled={full}
          placeholder={full ? `Up to ${FILING_SENDER_DOMAINS_MAX} senders` : "e.g. lacity.org"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return
            e.preventDefault()
            add()
          }}
        />
        <button type="button" className="btn sm" disabled={full || text.trim() === ""} onClick={add}>
          Add
        </button>
      </div>
    </div>
  )
}

function HealthLine({ health, now }: { health: FilingRouteHealth; now: number }) {
  const parts = healthParts(health)
  if (parts.length === 0) return <>{NEVER_USED}</>
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={part.label}>
          {i > 0 && HEALTH_SEPARATOR}
          {part.label}{" "}
          {"at" in part ? (
            <span title={preciseDateTimeTitle(part.at)}>{formatAgo(part.at, now)}</span>
          ) : (
            part.value
          )}
        </React.Fragment>
      ))}
    </>
  )
}

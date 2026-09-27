"use client"

import * as React from "react"

import { Icons } from "@/components/icons"
import { LoadingState } from "@/components/shared/data-states"
import { useEventList } from "@/features/events/use-events"
import type { PickedEvent } from "@/features/users/user-hours"
import { useDebounced } from "@/hooks/use-debounced"
import { toAppError } from "@/lib/api"

const RESULT_LIMIT = 8

function EventPickIcon() {
  return (
    <span className="prow-ico hue-moss">
      <Icons.Calendar size={14} />
    </span>
  )
}

/**
 * Search-and-pick an event that can take hours. The `completed` facet is exactly the ended,
 * non-cancelled events, so an event the server would refuse for not having ended never appears.
 * Once picked, the control collapses to the chosen event with a "Change" affordance.
 */
export function EventPicker({
  value,
  onChange,
  disabled,
}: {
  value: PickedEvent | null
  onChange: (event: PickedEvent | null) => void
  disabled?: boolean
}) {
  const [query, setQuery] = React.useState("")
  const debounced = useDebounced(query, 200)
  const q = debounced.trim()
  const list = useEventList(
    { q: q === "" ? undefined : q, filter: "completed", limit: RESULT_LIMIT },
    { keepPreviousData: true },
  )
  const results = list.data?.items ?? []

  if (value) {
    return (
      <div className="user-pick picked">
        <EventPickIcon />
        <div className="user-pick-text">
          <span className="user-pick-name">{value.title}</span>
          <span className="user-pick-handle">
            {value.place} · {value.when}
          </span>
        </div>
        <button
          type="button"
          className="btn sm ghost"
          disabled={disabled}
          onClick={() => onChange(null)}
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="user-pick">
      <div className="searchbox user-pick-search">
        <Icons.Search size={14} />
        <input
          type="text"
          aria-label="Search ended events by title or place"
          autoComplete="off"
          placeholder="Search ended events by title or place…"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {list.isLoading ? (
        <div className="user-pick-results">
          <LoadingState label="Searching…" />
        </div>
      ) : list.isError ? (
        <div className="user-pick-results">
          <div className="user-pick-note tone-alert">{toAppError(list.error).message}</div>
        </div>
      ) : results.length === 0 ? (
        <div className="user-pick-results">
          <div className="user-pick-note" role="status">
            {q === "" ? "No ended events yet." : `No ended event matches “${q}”.`}
          </div>
        </div>
      ) : (
        <ul className="user-pick-results" aria-label="Matching events">
          {results.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                className="user-pick-row"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    id: event.id,
                    title: event.title,
                    place: event.place,
                    when: event.date.abs,
                  })
                }
              >
                <EventPickIcon />
                <span className="user-pick-text">
                  <span className="user-pick-name">{event.title}</span>
                  <span className="user-pick-handle">
                    {event.place} · {event.date.abs}
                  </span>
                </span>
                {event.flagged && <span className="pill status-flag tight">flagged</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

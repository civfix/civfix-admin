"use client"

import * as React from "react"
import {
  ErrorCode,
  USER_STATUS_LABELS,
  avatarColor,
  monogram,
  type AdminUserListItemDTO,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { LoadingState } from "@/components/shared/data-states"
import { useUserList } from "@/features/users/use-users"
import { userSearchTerm } from "@/features/users/user-search"
import { useDebounced } from "@/hooks/use-debounced"
import { errorMessage } from "@/lib/error-messages"

const RESULT_ROWS = 8
const API_MAX_LIMIT = 100

export interface PickedUser {
  id: string
  name: string
  handle: string
  avatar?: AdminUserListItemDTO["avatar"]
  avatarUrl?: string | null
}

export function PickedUserAvatar({ user, size = 28 }: { user: PickedUser; size?: number }) {
  const style: React.CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.4) }
  if (user.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="user-av" style={style} src={user.avatarUrl} alt="" />
  }
  return (
    <span className="user-av" style={{ ...style, background: user.avatar?.[0] ?? avatarColor(user.id) }}>
      {monogram(user.name)}
    </span>
  )
}

/**
 * Once picked, the control collapses to the chosen user so the form keeps a stable height. Ownership
 * is assigned by id (DECISIONS §32); the handle is only how the operator finds the person.
 */
export function UserPicker({
  value,
  onChange,
  placeholder = "Search by name, handle or city…",
  excludeIds,
  autoFocus,
  labelledBy,
  describedBy,
}: {
  value: PickedUser | null
  onChange: (user: PickedUser | null) => void
  placeholder?: string
  /** Users already in the org (hidden from the results so they cannot be added twice). */
  excludeIds?: ReadonlySet<string>
  autoFocus?: boolean
  /** Id of the form's visible label for this field; replaces the built-in search label. */
  labelledBy?: string
  describedBy?: string
}) {
  const [query, setQuery] = React.useState("")
  const debounced = useDebounced(query, 200)
  const q = debounced.trim()
  // Members are filtered out here, not by the API, so the page is widened by their count to still fill
  // the result rows with people who can be added.
  const limit = Math.min(API_MAX_LIMIT, RESULT_ROWS + (excludeIds?.size ?? 0))
  const list = useUserList({ q: userSearchTerm(debounced), limit }, { keepPreviousData: true })
  const fetched = React.useMemo(() => list.data?.items ?? [], [list.data])
  const results = React.useMemo(
    () => fetched.filter((u) => !excludeIds?.has(u.id)).slice(0, RESULT_ROWS),
    [fetched, excludeIds],
  )
  const emptyNote =
    q === ""
      ? "Type to search users."
      : fetched.length > 0
        ? "Everyone matching is already a member."
        : `No user matches “${q}”.`
  const announcement =
    list.isLoading || list.isError
      ? ""
      : results.length === 0
        ? emptyNote
        : `${results.length} matching ${results.length === 1 ? "user" : "users"}`

  if (value) {
    return (
      <div className="user-pick picked">
        <PickedUserAvatar user={value} />
        <div className="user-pick-text">
          <span className="user-pick-name">{value.name}</span>
          <span className="user-pick-handle">{value.handle}</span>
        </div>
        <button
          type="button"
          className="btn sm ghost"
          aria-label="Change selected user"
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
          aria-label={labelledBy ? undefined : "Search users by name, handle or city"}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {/* Stays mounted so a screen reader hears each new result count; the visible note is hidden from it
          to avoid reading the same line twice. */}
      <span className="visually-hidden" role="status">
        {announcement}
      </span>
      {/* Plain buttons in a list: each result is an ordinary Tab stop that picks the user. */}
      {list.isLoading ? (
        <div className="user-pick-results">
          <LoadingState label="Searching…" />
        </div>
      ) : list.isError ? (
        <div className="user-pick-results">
          <div className="user-pick-note tone-alert">
            {errorMessage(list.error, {
              [ErrorCode.INTERNAL]: "Could not search users. Check your connection and try again.",
            })}
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="user-pick-results">
          <div className="user-pick-note" aria-hidden="true">
            {emptyNote}
          </div>
        </div>
      ) : (
        <ul className="user-pick-results" aria-label="Matching users">
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="user-pick-row"
                onClick={() =>
                  onChange({
                    id: u.id,
                    name: u.name,
                    handle: u.handle,
                    avatar: u.avatar,
                    avatarUrl: u.avatarUrl,
                  })
                }
              >
                <PickedUserAvatar user={u} />
                <span className="user-pick-text">
                  <span className="user-pick-name">{u.name}</span>
                  <span className="user-pick-handle">
                    {u.handle}
                    {u.city && u.city !== "-" ? ` · ${u.city}` : ""}
                  </span>
                </span>
                {u.deletedAt && <span className="pill status-flag tight">Deleted</span>}
                {u.status !== "active" && (
                  <span className="pill status-flag tight">
                    {USER_STATUS_LABELS[u.status] ?? u.status}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

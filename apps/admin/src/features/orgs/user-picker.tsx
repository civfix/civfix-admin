"use client"

import * as React from "react"
import { avatarColor, monogram, type AdminUserListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { LoadingState } from "@/components/shared/data-states"
import { useUserList } from "@/features/users/use-users"
import { useDebounced } from "@/hooks/use-debounced"
import { toAppError } from "@/lib/api"

/** The minimum a picked user needs to render: id, name, handle (avatar optional). */
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
 * Search-and-pick a user by name, @handle or email through the admin users list. Once picked, the
 * control collapses to the chosen user with a "Change" affordance so the form keeps a stable height.
 * Ownership is assigned by id (DECISIONS §32): the handle is only how the operator finds the person.
 */
export function UserPicker({
  value,
  onChange,
  placeholder = "Search by name, @handle or email…",
  excludeIds,
  autoFocus,
}: {
  value: PickedUser | null
  onChange: (user: PickedUser | null) => void
  placeholder?: string
  /** Users already in the org (hidden from the results so they cannot be added twice). */
  excludeIds?: ReadonlySet<string>
  autoFocus?: boolean
}) {
  const [query, setQuery] = React.useState("")
  const debounced = useDebounced(query, 200)
  const q = debounced.trim()
  const list = useUserList({ q: q === "" ? undefined : q, limit: 8 }, { keepPreviousData: true })
  const results = React.useMemo(
    () => (list.data?.items ?? []).filter((u) => !excludeIds?.has(u.id)),
    [list.data, excludeIds],
  )

  if (value) {
    return (
      <div className="user-pick picked">
        <PickedUserAvatar user={value} />
        <div className="user-pick-text">
          <span className="user-pick-name">{value.name}</span>
          <span className="user-pick-handle">{value.handle}</span>
        </div>
        <button type="button" className="btn sm ghost" onClick={() => onChange(null)}>
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
          aria-label="Search users by name, handle or email"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {/* Plain buttons in a list: each result is an ordinary Tab stop that picks the user. */}
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
            {q === "" ? "Type to search users." : `No user matches “${q}”.`}
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
                {u.status !== "active" && (
                  <span className="pill status-flag tight">{u.status}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

"use client"

import * as React from "react"
import { avatarColor, monogram, type AdminUserListItemDTO } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { LoadingState } from "@/components/shared/data-states"
import { useDebounced } from "@/hooks/use-debounced"
import { api, toAppError } from "@/lib/api"
import { queryKeys } from "@/lib/query"

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
  const params = { q: q === "" ? undefined : q, limit: 8 }
  const list = useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => api.listAdminUsers(params),
    placeholderData: keepPreviousData,
  })
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
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="user-pick-results" role="listbox">
        {list.isLoading ? (
          <LoadingState label="Searching…" />
        ) : list.isError ? (
          <div className="user-pick-note tone-alert">{toAppError(list.error).message}</div>
        ) : results.length === 0 ? (
          <div className="user-pick-note">
            {q === "" ? "Type to search users." : `No user matches “${q}”.`}
          </div>
        ) : (
          results.map((u) => (
            <button
              key={u.id}
              type="button"
              role="option"
              aria-selected={false}
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
          ))
        )}
      </div>
    </div>
  )
}

"use client"

import * as React from "react"
import type { AdminOrgDTO, AdminOrgMemberDTO, OrganizationMemberRole } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog, promptDialog } from "@/components/shared/dialog"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { EmptyState } from "@/components/shared/page-primitives"
import { formatDate } from "@/lib/dates"
import {
  ORG_ROLE_LABEL,
  ORG_ROLE_PILL,
  ORG_ROLES,
  canRemoveMember,
  menuFocusIndex,
  roleChangeCopy,
  roleTargets,
} from "@/features/orgs/org-members"
import { ReasonField } from "@/features/orgs/org-form-fields"
import {
  useAddOrgMember,
  useOrgMembersInfinite,
  useRemoveOrgMember,
  useSetOrgMemberRole,
} from "@/features/orgs/use-orgs"
import { PickedUserAvatar, UserPicker, type PickedUser } from "@/features/orgs/user-picker"
import { useNav, useToast } from "@/store/ui-store"

export function MembersPanel({ org }: { org: AdminOrgDTO }) {
  const q = useOrgMembersInfinite(org.id)
  const members = React.useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data])
  const owner = members.find((m) => m.role === "owner") ?? null
  const memberIds = React.useMemo(() => new Set(members.map((m) => m.user.id)), [members])
  const [adding, setAdding] = React.useState(false)
  const suspended = !!org.suspendedAt

  return (
    <div className="org-panel">
      {adding ? (
        <AddMemberForm
          org={org}
          ownerName={owner?.user.name ?? org.owner?.name ?? null}
          excludeIds={memberIds}
          onDone={() => setAdding(false)}
        />
      ) : (
        <div className="rep-actions top">
          <span className="rep-actions-label">Members</span>
          <span className="muted">{org.memberCount.toLocaleString()} total</span>
          <div className="spacer" />
          <button
            type="button"
            className="btn primary sm"
            onClick={() => setAdding(true)}
            disabled={!!org.deletedAt}
            title={suspended ? "The organization is suspended; members can still be managed." : undefined}
          >
            <Icons.Plus size={13} /> Add member
          </button>
        </div>
      )}

      <div className="sub">
        <div className="sub-head">
          Roster
          <span className="rep-confirms" style={{ marginLeft: "auto" }}>
            <Icons.Users size={12} /> {members.length}
          </span>
        </div>
        <div className="queue-list">
          {q.isLoading ? (
            <LoadingState label="Loading members..." />
          ) : q.isError ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load members" />
          ) : members.length === 0 ? (
            <EmptyState
              title="No members"
              sub="Every organization needs an owner. Add one to start."
              icon={<Icons.Users size={20} />}
            />
          ) : (
            <>
              {members.map((m) => (
                <MemberRow
                  key={m.user.id}
                  org={org}
                  member={m}
                  ownerName={owner?.user.name ?? null}
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
      </div>
    </div>
  )
}

function MemberRow({
  org,
  member,
  ownerName,
}: {
  org: AdminOrgDTO
  member: AdminOrgMemberDTO
  ownerName: string | null
}) {
  const nav = useNav()
  const toast = useToast()
  const setRole = useSetOrgMemberRole()
  const remove = useRemoveOrgMember()
  // The menu is position:fixed (anchored to the trigger's rect) so the card's overflow:hidden and the
  // roster's rounded clip cannot cut it off; it flips upward when the trigger is near the bottom.
  const [menuPos, setMenuPos] = React.useState<{ top?: number; bottom?: number; right: number } | null>(
    null,
  )
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const popRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  // True from a menu choice until its dialog resolves: the menu is closed by then, but a keyboard
  // user can reopen it and pick again while the prompt is still up.
  const prompting = React.useRef(false)
  const menuOpen = menuPos !== null
  const busy = setRole.isPending || remove.isPending
  const removable = canRemoveMember(member.role)

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const right = Math.max(8, window.innerWidth - rect.right)
    const flipUp = rect.bottom + 220 > window.innerHeight
    setMenuPos(flipUp ? { bottom: window.innerHeight - rect.top + 4, right } : { top: rect.bottom + 4, right })
  }
  /** Close the menu; `returnFocus` hands focus back to the trigger (keyboard dismissals). */
  const closeMenu = React.useCallback((returnFocus: boolean) => {
    setMenuPos(null)
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true })
  }, [])

  const menuItems = () =>
    Array.from(
      popRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
    )

  // A real menu: the first item takes focus on open; arrows/Home/End move (wrapping), Escape closes
  // and returns focus to the trigger, and focus leaving the menu (Tab, a click elsewhere) closes it.
  React.useEffect(() => {
    if (!menuOpen) return
    menuItems()[0]?.focus({ preventScroll: true })
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closeMenu(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // The menu owns this Escape: nothing above it (the shell's go-home) should also react.
        e.preventDefault()
        e.stopPropagation()
        closeMenu(true)
      }
    }
    const onScroll = () => closeMenu(false)
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onScroll)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
    }
  }, [menuOpen, closeMenu])

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = menuItems()
    const current = items.findIndex((el) => el === document.activeElement)
    const next = menuFocusIndex(e.key, current, items.length)
    if (next === null) return
    e.preventDefault()
    items[next]?.focus({ preventScroll: true })
  }
  const onMenuBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const to = e.relatedTarget as Node | null
    if (!to || !wrapRef.current?.contains(to)) closeMenu(false)
  }

  const onChangeRole = async (to: OrganizationMemberRole) => {
    closeMenu(true)
    if (prompting.current || busy) return
    const copy = roleChangeCopy({
      memberName: member.user.name,
      from: member.role,
      to,
      orgName: org.name,
      currentOwnerName: ownerName,
    })
    prompting.current = true
    let reason: string | null
    try {
      if (member.role === "owner") {
        // An org must keep an owner: the backend refuses a plain demotion, so explain instead of trying.
        await confirmDialog({
          title: copy.title,
          body: copy.body,
          confirmLabel: "Got it",
          cancelLabel: "Close",
        })
        return
      }
      reason = await promptDialog({
        title: copy.title,
        body: copy.body,
        label: "Reason (required)",
        placeholder: copy.transfer
          ? "Founder stepped down; board appointed a new lead…"
          : "Requested by the organization's owner…",
        confirmLabel: copy.confirmLabel,
        required: true,
        danger: copy.transfer,
      })
    } finally {
      prompting.current = false
    }
    if (reason === null || reason.trim() === "") return
    setRole.mutate(
      { id: org.id, userId: member.user.id, role: to, reason: reason.trim() },
      {
        onSuccess: () =>
          toast(
            copy.transfer
              ? `${member.user.name} now owns ${org.name}`
              : `${member.user.name} · ${ORG_ROLE_LABEL[to]}`,
          ),
      },
    )
  }

  const onRemove = async () => {
    closeMenu(true)
    if (prompting.current || busy) return
    prompting.current = true
    let reason: string | null
    try {
      reason = await promptDialog({
        title: `Remove ${member.user.name} from ${org.name}?`,
        body: "They lose access to the organization, its events and its broadcasts immediately. Their account is untouched. The reason is written to the audit log.",
        label: "Reason (required)",
        placeholder: "Left the organization; confirmed by the owner…",
        confirmLabel: "Remove member",
        required: true,
        danger: true,
      })
    } finally {
      prompting.current = false
    }
    if (reason === null || reason.trim() === "") return
    remove.mutate(
      { id: org.id, userId: member.user.id, reason: reason.trim() },
      { onSuccess: () => toast(`${member.user.name} removed from ${org.name}`) },
    )
  }

  const picked: PickedUser = { id: member.user.id, name: member.user.name, handle: member.user.handle }

  return (
    <div className="qrow static member-row">
      <PickedUserAvatar user={picked} size={32} />
      <div className="body">
        <div className="top">
          <span
            className="title lnk-inline"
            role="button"
            tabIndex={0}
            title="Open profile"
            onClick={() => nav("users", member.user.id)}
            onKeyDown={(e) => {
              if (!isKeyboardActivationKey(e.key)) return
              e.preventDefault()
              nav("users", member.user.id)
            }}
          >
            {member.user.name}
          </span>
          <span className="ident">{member.user.handle}</span>
        </div>
        <div className="sub">
          <span>Joined {formatDate(member.joinedAt)}</span>
          {member.role === "owner" && (
            <>
              <span className="sep">·</span>
              <span className="muted">Transfer ownership before removing</span>
            </>
          )}
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${ORG_ROLE_PILL[member.role]} tight`}>
          {member.role === "owner" && <Icons.Star size={9} />} {ORG_ROLE_LABEL[member.role]}
        </span>
        <div className="row-menu" ref={wrapRef}>
          <button
            ref={triggerRef}
            type="button"
            className="btn sm ghost icon"
            aria-label={`Actions for ${member.user.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            disabled={busy || !!org.deletedAt}
            onClick={() => (menuOpen ? closeMenu(false) : openMenu())}
            onKeyDown={(e) => {
              // ArrowDown on a closed menu button opens it (WAI-ARIA menu-button pattern).
              if (!menuOpen && e.key === "ArrowDown") {
                e.preventDefault()
                openMenu()
              }
            }}
          >
            <Icons.MoreH size={14} />
          </button>
          {menuPos && (
            <div
              className="row-menu-pop"
              role="menu"
              aria-label={`Actions for ${member.user.name}`}
              ref={popRef}
              style={menuPos}
              onKeyDown={onMenuKeyDown}
              onBlur={onMenuBlur}
            >
              <div className="row-menu-label">Change role</div>
              {roleTargets(member.role).map((r) => (
                <button
                  key={r}
                  type="button"
                  role="menuitem"
                  className="row-menu-item"
                  onClick={() => void onChangeRole(r)}
                >
                  {r === "owner" ? (
                    <>
                      <Icons.Star size={12} /> Transfer ownership
                    </>
                  ) : (
                    <>Make {ORG_ROLE_LABEL[r].toLowerCase()}</>
                  )}
                </button>
              ))}
              <div className="row-menu-sep" />
              <button
                type="button"
                role="menuitem"
                className="row-menu-item danger"
                disabled={!removable}
                title={removable ? undefined : "Transfer ownership first"}
                onClick={() => void onRemove()}
              >
                <Icons.Trash size={12} /> Remove{removable ? "" : " (transfer ownership first)"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AddMemberForm({
  org,
  ownerName,
  excludeIds,
  onDone,
}: {
  org: AdminOrgDTO
  ownerName: string | null
  excludeIds: ReadonlySet<string>
  onDone: () => void
}) {
  const add = useAddOrgMember()
  const toast = useToast()
  const [user, setUser] = React.useState<PickedUser | null>(null)
  const [role, setRole] = React.useState<OrganizationMemberRole>("member")
  const [reason, setReason] = React.useState("")
  const [attempted, setAttempted] = React.useState(false)
  // Guards a second Enter while the transfer confirmation is open.
  const confirming = React.useRef(false)
  const transfer = role === "owner"

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (confirming.current || add.isPending) return
    setAttempted(true)
    if (!user || reason.trim() === "") return
    if (transfer) {
      confirming.current = true
      let ok: boolean
      try {
        ok = await confirmDialog({
          title: `Transfer ownership of ${org.name} to ${user.name}?`,
          body: `An organization has exactly one owner. ${user.name} becomes the owner and ${ownerName ?? "the current owner"} becomes an admin in the same change.`,
          confirmLabel: "Transfer ownership",
          danger: true,
        })
      } finally {
        confirming.current = false
      }
      if (!ok) return
    }
    add.mutate(
      { id: org.id, userId: user.id, role, reason: reason.trim() },
      {
        onSuccess: () => {
          toast(
            transfer
              ? `${user.name} now owns ${org.name}`
              : `${user.name} added as ${ORG_ROLE_LABEL[role].toLowerCase()}`,
          )
          onDone()
        },
      },
    )
  }

  return (
    <form className="sub" onSubmit={(e) => void submit(e)}>
      <div className="sub-head">Add member</div>
      <div className="sub-body">
        <div className={`field ${attempted && !user ? "has-error" : ""}`}>
          <span className="lbl">Person</span>
          <UserPicker value={user} onChange={setUser} excludeIds={excludeIds} autoFocus />
          {attempted && !user && (
            <span className="field-error" role="alert">
              <Icons.AlertTriangle size={11} /> Pick a user to add.
            </span>
          )}
        </div>
        <div className="field">
          <label className="lbl" htmlFor="org-add-role">
            Role
          </label>
          <select
            id="org-add-role"
            value={role}
            disabled={add.isPending}
            onChange={(e) => setRole(e.target.value as OrganizationMemberRole)}
          >
            {ORG_ROLES.map((r) => (
              <option key={r} value={r}>
                {r === "owner" ? "Owner (transfer ownership)" : ORG_ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          {transfer && (
            <span className="hint tone-warn">
              <Icons.AlertTriangle size={11} /> Choosing owner transfers ownership:{" "}
              {ownerName ?? "the current owner"} becomes an admin.
            </span>
          )}
        </div>
        <ReasonField
          id="org-add-reason"
          value={reason}
          onChange={setReason}
          error={attempted && reason.trim() === "" ? "A reason is required." : undefined}
          placeholder="Joined as volunteer coordinator; confirmed by the owner…"
          disabled={add.isPending}
        />
        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onDone} disabled={add.isPending}>
            Cancel
          </button>
          <button type="submit" className={`btn ${transfer ? "danger" : "primary"}`} disabled={add.isPending}>
            <Icons.Plus size={13} /> {add.isPending ? "Adding…" : transfer ? "Add and transfer" : "Add member"}
          </button>
        </div>
      </div>
    </form>
  )
}

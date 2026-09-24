"use client"

import * as React from "react"
import type { AdminOrgDTO, AdminOrgMemberDTO, OrganizationMemberRole } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { confirmDialog, promptDialog } from "@/components/shared/dialog"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { EmptyState } from "@/components/shared/page-primitives"
import { formatDate } from "@/lib/dates"
import { flatPages } from "@/lib/infinite"
import {
  ORG_ROLE_LABEL,
  ORG_ROLE_PILL,
  ORG_ROLES,
  roleChangeCopy,
  roleTargets,
} from "@/features/orgs/org-members"
import { FieldError, ReasonField, fieldErrorId } from "@/features/orgs/org-form-fields"
import {
  useAddOrgMember,
  useOrgMemberListInfinite,
  useRemoveOrgMember,
  useSetOrgMemberRole,
} from "@/features/orgs/use-orgs"
import { PickedUserAvatar, UserPicker, type PickedUser } from "@/features/orgs/user-picker"
import { useRowMenu, type RowMenu } from "@/features/orgs/use-row-menu"
import { useNav } from "@/store/ui-store"

const MEMBER_AVATAR_SIZE = 32
const REASON_LABEL = "Reason (required)"
const CURRENT_OWNER_FALLBACK = "the current owner"
const PERSON_FIELD_ID = "org-add-person"
const PERSON_LABEL_ID = "org-add-person-label"

function useRoster(org: AdminOrgDTO) {
  const q = useOrgMemberListInfinite(org.id)
  const members = React.useMemo(() => flatPages(q.data), [q.data])
  const ownerName = members.find((m) => m.role === "owner")?.user.name ?? org.owner?.name ?? null
  return { q, members, ownerName }
}

type Roster = ReturnType<typeof useRoster>

function RosterBody({ org, roster: { q, members, ownerName } }: { org: AdminOrgDTO; roster: Roster }) {
  if (q.isLoading) return <LoadingState label="Loading members..." />
  if (q.isError && !q.data) {
    return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load members" />
  }
  if (members.length === 0) {
    return (
      <EmptyState
        title="No members"
        sub="Every organization needs an owner. Add one to start."
        icon={<Icons.Users size={20} />}
      />
    )
  }
  return (
    <>
      {members.map((m) => (
        <MemberRow key={m.user.id} org={org} member={m} ownerName={ownerName} />
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
  )
}

export function MembersPanel({ org }: { org: AdminOrgDTO }) {
  const roster = useRoster(org)
  const { q, members, ownerName } = roster
  const memberIds = React.useMemo(() => new Set(members.map((m) => m.user.id)), [members])
  const [adding, setAdding] = React.useState(false)
  const suspended = !!org.suspendedAt

  return (
    <div className="org-panel">
      {adding ? (
        <AddMemberForm
          org={org}
          ownerName={ownerName}
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
            <Icons.Users size={12} />{" "}
            {q.hasNextPage
              ? `${members.length.toLocaleString()} of ${org.memberCount.toLocaleString()}`
              : members.length.toLocaleString()}
          </span>
        </div>
        <div className="queue-list">
          <RosterBody org={org} roster={roster} />
        </div>
      </div>
    </div>
  )
}

interface ReasonPrompt {
  title: string
  body: string
  placeholder: string
  confirmLabel: string | undefined
  danger: boolean
}

function useMemberActions(org: AdminOrgDTO, member: AdminOrgMemberDTO, ownerName: string | null) {
  const setRole = useSetOrgMemberRole()
  const remove = useRemoveOrgMember()
  // True from a menu choice until its dialog resolves: the menu is closed by then, but a keyboard
  // user can reopen it and pick again while the prompt is still up.
  const prompting = React.useRef(false)
  const busy = setRole.isPending || remove.isPending

  const askReason = async (prompt: ReasonPrompt): Promise<string | null> => {
    prompting.current = true
    let reason: string | null
    try {
      reason = await promptDialog({ ...prompt, label: REASON_LABEL, required: true })
    } finally {
      prompting.current = false
    }
    const trimmed = reason?.trim() ?? ""
    return trimmed === "" ? null : trimmed
  }

  const changeRole = async (to: OrganizationMemberRole) => {
    if (prompting.current || busy) return
    const copy = roleChangeCopy({
      memberName: member.user.name,
      from: member.role,
      to,
      orgName: org.name,
      currentOwnerName: ownerName,
    })
    const reason = await askReason({
      title: copy.title,
      body: copy.body,
      placeholder: copy.transfer
        ? "Founder stepped down; board appointed a new lead…"
        : "Requested by the organization's owner…",
      confirmLabel: copy.confirmLabel,
      danger: copy.transfer,
    })
    if (reason === null) return
    setRole.mutate({
      request: { id: org.id, userId: member.user.id, role: to, reason },
      memberName: member.user.name,
      orgName: org.name,
    })
  }

  const removeMember = async () => {
    if (prompting.current || busy) return
    const reason = await askReason({
      title: `Remove ${member.user.name} from ${org.name}?`,
      body: "They lose access to the organization, its events and its broadcasts immediately. Their account is untouched. The reason is written to the audit log.",
      placeholder: "Left the organization; confirmed by the owner…",
      confirmLabel: "Remove member",
      danger: true,
    })
    if (reason === null) return
    remove.mutate({
      request: { id: org.id, userId: member.user.id, reason },
      memberName: member.user.name,
      orgName: org.name,
    })
  }

  return { busy, changeRole, removeMember }
}

function MemberActionsMenu({
  member,
  menu,
  onChangeRole,
  onRemove,
}: {
  member: AdminOrgMemberDTO
  menu: RowMenu
  onChangeRole: (to: OrganizationMemberRole) => void
  onRemove: () => void
}) {
  if (!menu.position) return null
  return (
    <div
      className="row-menu-pop"
      role="menu"
      aria-label={`Actions for ${member.user.name}`}
      ref={menu.popRef}
      style={menu.position}
      onKeyDown={menu.onMenuKeyDown}
      onBlur={menu.onMenuBlur}
    >
      <div className="row-menu-label" role="presentation">
        Change role
      </div>
      {roleTargets(member.role).map((r) => (
        <button
          key={r}
          type="button"
          role="menuitem"
          className="row-menu-item"
          onClick={() => onChangeRole(r)}
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
      <div className="row-menu-sep" role="separator" />
      <button type="button" role="menuitem" className="row-menu-item danger" onClick={onRemove}>
        <Icons.Trash size={12} /> Remove
      </button>
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
  const menu = useRowMenu()
  const actions = useMemberActions(org, member, ownerName)
  // The backend refuses every change to the owner's own membership: ownership moves by promoting
  // someone else, so the owner row has no actions.
  const isOwner = member.role === "owner"
  const picked: PickedUser = { id: member.user.id, name: member.user.name, handle: member.user.handle }
  const openProfile = () => nav("users", member.user.id)

  return (
    <div className="qrow static member-row">
      <PickedUserAvatar user={picked} size={MEMBER_AVATAR_SIZE} />
      <div className="body">
        <div className="top">
          <span
            className="title lnk-inline"
            role="button"
            tabIndex={0}
            title="Open profile"
            onClick={openProfile}
            onKeyDown={(e) => {
              if (!isKeyboardActivationKey(e.key)) return
              e.preventDefault()
              openProfile()
            }}
          >
            {member.user.name}
          </span>
          <span className="ident">{member.user.handle}</span>
        </div>
        <div className="sub">
          <span>Joined {formatDate(member.joinedAt)}</span>
          {isOwner && (
            <>
              <span className="sep">·</span>
              <span className="muted">Transfer ownership before changing this role or removing</span>
            </>
          )}
        </div>
      </div>
      <div className="trailing">
        <span className={`pill ${ORG_ROLE_PILL[member.role]} tight`}>
          {isOwner && <Icons.Star size={9} />} {ORG_ROLE_LABEL[member.role]}
        </span>
        <div className="row-menu" ref={menu.wrapRef}>
          <button
            ref={menu.triggerRef}
            type="button"
            className="btn sm ghost icon"
            aria-label={`Actions for ${member.user.name}`}
            aria-haspopup="menu"
            aria-expanded={menu.open}
            disabled={actions.busy || isOwner || !!org.deletedAt}
            onClick={menu.toggle}
            onKeyDown={menu.onTriggerKeyDown}
          >
            <Icons.MoreH size={14} />
          </button>
          <MemberActionsMenu
            member={member}
            menu={menu}
            onChangeRole={(to) => {
              menu.close(true)
              void actions.changeRole(to)
            }}
            onRemove={() => {
              menu.close(true)
              void actions.removeMember()
            }}
          />
        </div>
      </div>
    </div>
  )
}

function RoleField({
  role,
  onChange,
  ownerName,
  disabled,
}: {
  role: OrganizationMemberRole
  onChange: (role: OrganizationMemberRole) => void
  ownerName: string | null
  disabled: boolean
}) {
  return (
    <div className="field">
      <label className="lbl" htmlFor="org-add-role">
        Role
      </label>
      <select
        id="org-add-role"
        value={role}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as OrganizationMemberRole)}
      >
        {ORG_ROLES.map((r) => (
          <option key={r} value={r}>
            {r === "owner" ? "Owner (transfer ownership)" : ORG_ROLE_LABEL[r]}
          </option>
        ))}
      </select>
      {role === "owner" && (
        <span className="hint tone-warn">
          <Icons.AlertTriangle size={11} /> Choosing owner transfers ownership:{" "}
          {ownerName ?? CURRENT_OWNER_FALLBACK} becomes an admin.
        </span>
      )}
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
  const [user, setUser] = React.useState<PickedUser | null>(null)
  const [role, setRole] = React.useState<OrganizationMemberRole>("member")
  const [reason, setReason] = React.useState("")
  const [attempted, setAttempted] = React.useState(false)
  // Guards a second Enter while the transfer confirmation is open.
  const confirming = React.useRef(false)
  const transfer = role === "owner"
  const personError = attempted && !user ? "Pick a user to add." : null

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
          body: `An organization has exactly one owner. ${user.name} becomes the owner and ${ownerName ?? CURRENT_OWNER_FALLBACK} becomes an admin in the same change.`,
          confirmLabel: "Transfer ownership",
          danger: true,
        })
      } finally {
        confirming.current = false
      }
      if (!ok) return
    }
    add.mutate(
      {
        request: { id: org.id, userId: user.id, role, reason: reason.trim() },
        memberName: user.name,
        orgName: org.name,
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="sub" onSubmit={(e) => void submit(e)}>
      <div className="sub-head">Add member</div>
      <div className="sub-body">
        <div
          className={`field ${personError ? "has-error" : ""}`}
          role="group"
          aria-labelledby={PERSON_LABEL_ID}
          aria-describedby={personError ? fieldErrorId(PERSON_FIELD_ID) : undefined}
        >
          <span className="lbl" id={PERSON_LABEL_ID}>
            Person
          </span>
          <UserPicker value={user} onChange={setUser} excludeIds={excludeIds} autoFocus />
          <FieldError id={fieldErrorId(PERSON_FIELD_ID)} text={personError} />
        </div>
        <RoleField
          role={role}
          onChange={setRole}
          ownerName={ownerName}
          disabled={add.isPending}
        />
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

"use client"

import * as React from "react"
import {
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORMS,
  socialLinkUrl,
  type AdminOrgDTO,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import { promptDialog } from "@/components/shared/dialog"
import { formatDate, formatDateTime } from "@/lib/dates"
import { EMPTY_VALUE } from "@/lib/empty-value"
import {
  buildUpdateRequest,
  clearChangedFieldErrors,
  draftFromOrg,
  hasProfileChanges,
  updateFieldErrors,
  validateProfileDraft,
  type OrgProfileDraft,
  type OrgProfileErrors,
} from "@/features/orgs/org-form"
import { OrgProfileFields } from "@/features/orgs/org-form-fields"
import { DeletedFact, Fact, OrgStatusSubHead, UrlFact, kindLabel } from "@/features/orgs/org-facts"
import { PUBLIC_ORG_URL_LABEL, normalizeSlug, publicOrgUrl } from "@/features/orgs/org-slug"
import { useUpdateOrg } from "@/features/orgs/use-orgs"
import { useNav } from "@/store/ui-store"

export function ProfilePanel({ org }: { org: AdminOrgDTO }) {
  const [editing, setEditing] = React.useState(false)
  return editing ? (
    <ProfileEditor org={org} onDone={() => setEditing(false)} />
  ) : (
    <ProfileView org={org} onEdit={() => setEditing(true)} />
  )
}

const SOCIAL_LINK_PILL = "pill priority-low"

function SocialLinksFact({ links }: { links: AdminOrgDTO["socialLinks"] }) {
  const present = SOCIAL_PLATFORMS.flatMap((p) => {
    const handle = links?.[p]
    return handle ? [{ platform: p, handle }] : []
  })
  if (present.length === 0) return <>{EMPTY_VALUE}</>
  return (
    <span className="social-links">
      {present.map(({ platform, handle }) => (
        <a
          key={platform}
          className={SOCIAL_LINK_PILL}
          href={socialLinkUrl(platform, handle)}
          target="_blank"
          rel="noreferrer noopener"
          title={SOCIAL_PLATFORM_LABELS[platform]}
        >
          {SOCIAL_PLATFORM_LABELS[platform]} · {handle}
        </a>
      ))}
    </span>
  )
}

function ProfileFacts({ org }: { org: AdminOrgDTO }) {
  return (
    <div className="user-meta-rows" style={{ marginTop: 10 }}>
      <Fact label="Public page">
        <a href={publicOrgUrl(org.slug)} target="_blank" rel="noreferrer noopener">
          {PUBLIC_ORG_URL_LABEL}
          {org.slug}
        </a>
      </Fact>
      <Fact label="Kind">{kindLabel(org.verifiedKind)}</Fact>
      <Fact label="Website">
        <UrlFact url={org.websiteUrl} />
      </Fact>
      <Fact label="Donation link">
        <UrlFact url={org.donationUrl} />
      </Fact>
      <Fact label="Social">
        <SocialLinksFact links={org.socialLinks} />
      </Fact>
      <Fact label="Members" mono>
        {org.memberCount.toLocaleString()}
      </Fact>
      <Fact label="Events" mono>
        {org.eventCount.toLocaleString()}
      </Fact>
      <Fact label="Created">{formatDate(org.createdAt)}</Fact>
      <Fact label="Updated">{formatDateTime(org.updatedAt)}</Fact>
      <Fact label="Verified">{formatDateTime(org.verifiedAt)}</Fact>
      <DeletedFact deletedAt={org.deletedAt} />
    </div>
  )
}

function ProfileView({ org, onEdit }: { org: AdminOrgDTO; onEdit: () => void }) {
  const nav = useNav()
  const owner = org.owner
  return (
    <div className="org-panel">
      <div className="sub">
        <OrgStatusSubHead title="Profile" org={org} />
        <div className="sub-body">
          {org.description ? (
            <p className="rep-desc">{org.description}</p>
          ) : (
            <p className="rep-desc muted">No description yet.</p>
          )}
          <ProfileFacts org={org} />
          {owner && (
            <button
              type="button"
              className="btn sm ghost full"
              style={{ marginTop: 10 }}
              onClick={() => nav("users", owner.id)}
            >
              Owner · {owner.name} <span className="muted">{owner.handle}</span> →
            </button>
          )}
        </div>
      </div>

      <div className="rep-actions">
        <span className="rep-actions-label">Profile</span>
        <div className="spacer" />
        <button type="button" className="btn" onClick={onEdit} disabled={!!org.deletedAt}>
          <Icons.FileText size={13} /> Edit profile
        </button>
      </div>
    </div>
  )
}

function useProfileEditor(org: AdminOrgDTO, onDone: () => void) {
  const update = useUpdateOrg()
  // The draft and the diff share one snapshot taken when editing starts: diffing against the live
  // prop would PATCH an untouched field back to its old value after a mid-edit refetch.
  const [baseline] = React.useState(org)
  const [draft, setDraft] = React.useState<OrgProfileDraft>(() => draftFromOrg(baseline))
  const [serverErrors, setServerErrors] = React.useState<OrgProfileErrors>({})
  const [attempted, setAttempted] = React.useState(false)
  const [logoUploading, setLogoUploading] = React.useState(false)
  // True from the click until the reason prompt resolves: a second click while the prompt is open
  // must not queue a second prompt (and a second PATCH) behind it.
  const busy = React.useRef(false)

  const liveErrors = React.useMemo(
    () => (attempted ? { ...validateProfileDraft(draft), ...serverErrors } : serverErrors),
    [attempted, draft, serverErrors],
  )
  const dirty = hasProfileChanges(baseline, draft)
  const nextSlug = normalizeSlug(draft.slug)
  const slugChanged = nextSlug !== baseline.slug

  const save = async () => {
    if (busy.current || update.isPending || logoUploading) return
    setAttempted(true)
    const local = validateProfileDraft(draft)
    if (Object.keys(local).length > 0) return
    busy.current = true
    let reason: string | null
    try {
      reason = await promptDialog({
        title: `Save changes to ${org.name}?`,
        body: slugChanged
          ? `The slug changes from /${baseline.slug} to /${nextSlug}. Existing links, QR codes and signup pages that use the old slug stop working. The reason is written to the audit log.`
          : "The change is visible on the public page immediately. The reason is written to the audit log.",
        label: "Reason (required)",
        placeholder: "Corrected the website at the org's request…",
        confirmLabel: "Save changes",
        required: true,
        danger: slugChanged,
      })
    } finally {
      busy.current = false
    }
    if (reason === null || reason.trim() === "") return
    const body = buildUpdateRequest(baseline, draft, reason)
    if (!body) {
      onDone()
      return
    }
    setServerErrors({})
    update.mutate(body, {
      onSuccess: onDone,
      onError: (err) => setServerErrors(updateFieldErrors(err, body)),
    })
  }

  const changeDraft = (next: OrgProfileDraft) => {
    setServerErrors((prev) => clearChangedFieldErrors(prev, draft, next))
    setDraft(next)
  }

  return {
    draft,
    changeDraft,
    liveErrors,
    dirty,
    saving: update.isPending,
    logoUploading,
    setLogoUploading,
    save,
  }
}

function ProfileEditor({ org, onDone }: { org: AdminOrgDTO; onDone: () => void }) {
  const editor = useProfileEditor(org, onDone)
  const { saving, logoUploading } = editor

  return (
    <div className="org-panel">
      <div className="sub">
        <div className="sub-head">
          Edit profile
          <span className="pill status-progress tight" style={{ marginLeft: "auto" }}>
            Editing
          </span>
        </div>
        <div className="sub-body">
          <OrgProfileFields
            draft={editor.draft}
            errors={editor.liveErrors}
            onChange={editor.changeDraft}
            mode="edit"
            disabled={saving}
            onLogoUploadingChange={editor.setLogoUploading}
          />
        </div>
      </div>
      <div className="rep-actions">
        <span className="rep-actions-label">Profile</span>
        {logoUploading ? (
          <span className="muted">Uploading the logo…</span>
        ) : (
          !editor.dirty && <span className="muted">No changes yet</span>
        )}
        <div className="spacer" />
        <button
          type="button"
          className="btn ghost"
          onClick={onDone}
          disabled={saving || logoUploading}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={saving || logoUploading || !editor.dirty}
          onClick={() => void editor.save()}
        >
          <Icons.Check size={13} /> {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  )
}

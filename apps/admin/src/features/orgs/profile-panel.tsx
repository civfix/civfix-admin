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
import { isHttpsUrl } from "@/lib/external-url"
import { orgStatusView } from "@/lib/org-status"
import { EMPTY_VALUE } from "@/lib/empty-value"
import {
  buildUpdateRequest,
  clearChangedFieldErrors,
  draftFromOrg,
  updateFieldErrors,
  validateProfileDraft,
  type OrgProfileDraft,
  type OrgProfileErrors,
} from "@/features/orgs/org-form"
import { OrgProfileFields } from "@/features/orgs/org-form-fields"
import { publicOrgUrl } from "@/features/orgs/org-slug"
import { useUpdateOrg } from "@/features/orgs/use-orgs"
import { ORG_KIND_LABEL } from "@/features/orgs/org-verification"
import { useNav } from "@/store/ui-store"

export function ProfilePanel({ org }: { org: AdminOrgDTO }) {
  const [editing, setEditing] = React.useState(false)
  return editing ? (
    <ProfileEditor org={org} onDone={() => setEditing(false)} />
  ) : (
    <ProfileView org={org} onEdit={() => setEditing(true)} />
  )
}

/** Only an https url becomes a link; anything else stored is shown as text so it is never hidden. */
function UrlFact({ url }: { url: string | null | undefined }) {
  if (isHttpsUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer noopener">
        {url}
      </a>
    )
  }
  return <>{url || EMPTY_VALUE}</>
}

function ProfileView({ org, onEdit }: { org: AdminOrgDTO; onEdit: () => void }) {
  const nav = useNav()
  const statusView = orgStatusView(org.verifiedStatus)
  const socials = SOCIAL_PLATFORMS.filter((p) => !!org.socialLinks?.[p])
  return (
    <div className="org-panel">
      <div className="sub">
        <div className="sub-head">
          Profile
          <span className={`pill ${statusView.cls} tight`} style={{ marginLeft: "auto" }}>
            {statusView.label}
          </span>
        </div>
        <div className="sub-body">
          {org.description ? (
            <p className="rep-desc">{org.description}</p>
          ) : (
            <p className="rep-desc muted">No description yet.</p>
          )}
          <div className="user-meta-rows" style={{ marginTop: 10 }}>
            <div className="umr">
              <span>Public page</span>
              <span>
                <a href={publicOrgUrl(org.slug)} target="_blank" rel="noreferrer noopener">
                  civfix.org/orgs/{org.slug}
                </a>
              </span>
            </div>
            <div className="umr">
              <span>Kind</span>
              <span>{org.verifiedKind ? ORG_KIND_LABEL[org.verifiedKind] : EMPTY_VALUE}</span>
            </div>
            <div className="umr">
              <span>Website</span>
              <span>
                <UrlFact url={org.websiteUrl} />
              </span>
            </div>
            <div className="umr">
              <span>Donation link</span>
              <span>
                <UrlFact url={org.donationUrl} />
              </span>
            </div>
            <div className="umr">
              <span>Social</span>
              <span>
                {socials.length === 0 ? (
                  EMPTY_VALUE
                ) : (
                  <span className="social-links">
                    {socials.map((p) => (
                      <a
                        key={p}
                        className="pill priority-low"
                        href={socialLinkUrl(p, org.socialLinks![p]!)}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={SOCIAL_PLATFORM_LABELS[p]}
                      >
                        {SOCIAL_PLATFORM_LABELS[p]} · {org.socialLinks![p]}
                      </a>
                    ))}
                  </span>
                )}
              </span>
            </div>
            <div className="umr">
              <span>Members</span>
              <span className="mono">{org.memberCount.toLocaleString()}</span>
            </div>
            <div className="umr">
              <span>Events</span>
              <span className="mono">{org.eventCount.toLocaleString()}</span>
            </div>
            <div className="umr">
              <span>Created</span>
              <span>{formatDate(org.createdAt)}</span>
            </div>
            <div className="umr">
              <span>Updated</span>
              <span>{formatDateTime(org.updatedAt)}</span>
            </div>
            <div className="umr">
              <span>Verified</span>
              <span>{formatDateTime(org.verifiedAt)}</span>
            </div>
            {org.deletedAt && (
              <div className="umr">
                <span>Deleted</span>
                <span>{formatDateTime(org.deletedAt)}</span>
              </div>
            )}
          </div>
          {org.owner && (
            <button
              type="button"
              className="btn sm ghost full"
              style={{ marginTop: 10 }}
              onClick={() => nav("users", org.owner!.id)}
            >
              Owner · {org.owner.name} <span className="muted">{org.owner.handle}</span> →
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

function ProfileEditor({ org, onDone }: { org: AdminOrgDTO; onDone: () => void }) {
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
  const dirty = buildUpdateRequest(baseline, draft, "x") !== null
  const slugChanged = draft.slug.trim().toLowerCase() !== baseline.slug

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
          ? `The slug changes from /${baseline.slug} to /${draft.slug.trim().toLowerCase()}. Existing links, QR codes and signup pages that use the old slug stop working. The reason is written to the audit log.`
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
            draft={draft}
            errors={liveErrors}
            onChange={(next) => {
              setServerErrors((prev) => clearChangedFieldErrors(prev, draft, next))
              setDraft(next)
            }}
            mode="edit"
            disabled={update.isPending}
            onLogoUploadingChange={setLogoUploading}
          />
        </div>
      </div>
      <div className="rep-actions">
        <span className="rep-actions-label">Profile</span>
        {logoUploading ? (
          <span className="muted">Uploading the logo…</span>
        ) : (
          !dirty && <span className="muted">No changes yet</span>
        )}
        <div className="spacer" />
        <button
          type="button"
          className="btn ghost"
          onClick={onDone}
          disabled={update.isPending || logoUploading}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={update.isPending || logoUploading || !dirty}
          onClick={() => void save()}
        >
          <Icons.Check size={13} /> {update.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  )
}

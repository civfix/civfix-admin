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
import {
  SOCIAL_PLATFORMS as PROFILE_SOCIALS,
  buildUpdateRequest,
  clearChangedFieldErrors,
  draftFromOrg,
  fieldErrorsFromError,
  pickFieldErrors,
  validateProfileDraft,
  type OrgProfileDraft,
  type OrgProfileErrors,
} from "@/features/orgs/org-form"
import { OrgProfileFields } from "@/features/orgs/org-form-fields"
import { publicOrgUrl } from "@/features/orgs/org-slug"
import { toastUnlessShownInline, useUpdateOrg } from "@/features/orgs/use-orgs"
import { ORG_KIND_LABEL, ORG_STATUS_VIEW } from "@/features/orgs/verification-panel"
import { useNav, useToast } from "@/store/ui-store"

/** Read view of the org profile with an inline edit mode (adminUpdateOrg, reason prompted on save). */
export function ProfilePanel({ org }: { org: AdminOrgDTO }) {
  const [editing, setEditing] = React.useState(false)
  return editing ? (
    <ProfileEditor org={org} onDone={() => setEditing(false)} />
  ) : (
    <ProfileView org={org} onEdit={() => setEditing(true)} />
  )
}

function ProfileView({ org, onEdit }: { org: AdminOrgDTO; onEdit: () => void }) {
  const nav = useNav()
  const statusView = ORG_STATUS_VIEW[org.verifiedStatus]
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
              <span>{org.verifiedKind ? ORG_KIND_LABEL[org.verifiedKind] : "—"}</span>
            </div>
            <div className="umr">
              <span>Website</span>
              <span>
                {isHttpsUrl(org.websiteUrl) ? (
                  <a href={org.websiteUrl} target="_blank" rel="noreferrer noopener">
                    {org.websiteUrl}
                  </a>
                ) : (
                  (org.websiteUrl ?? "—")
                )}
              </span>
            </div>
            <div className="umr">
              <span>Donation link</span>
              <span>
                {isHttpsUrl(org.donationUrl) ? (
                  <a href={org.donationUrl} target="_blank" rel="noreferrer noopener">
                    {org.donationUrl}
                  </a>
                ) : (
                  "None"
                )}
              </span>
            </div>
            <div className="umr">
              <span>Social</span>
              <span>
                {socials.length === 0 ? (
                  "—"
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

/** The fields the editor renders; a server error on anything else (the reason, say) is toasted. */
const EDITOR_FIELDS: readonly (keyof OrgProfileErrors)[] = [
  "name",
  "slug",
  "description",
  "websiteUrl",
  "logoMediaId",
  ...PROFILE_SOCIALS,
]

function ProfileEditor({ org, onDone }: { org: AdminOrgDTO; onDone: () => void }) {
  const update = useUpdateOrg()
  const toast = useToast()
  const [draft, setDraft] = React.useState<OrgProfileDraft>(() => draftFromOrg(org))
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
  const dirty = buildUpdateRequest(org, draft, "x") !== null
  const slugChanged = draft.slug.trim().toLowerCase() !== org.slug

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
          ? `The slug changes from /${org.slug} to /${draft.slug.trim().toLowerCase()}. Existing links, QR codes and signup pages that use the old slug stop working. The reason is written to the audit log.`
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
    const body = buildUpdateRequest(org, draft, reason)
    if (!body) {
      onDone()
      return
    }
    setServerErrors({})
    update.mutate(body, {
      onSuccess: () => {
        toast(`${draft.name.trim()} updated`)
        onDone()
      },
      onError: (err) => {
        const shown = pickFieldErrors(fieldErrorsFromError(err, body), EDITOR_FIELDS)
        setServerErrors(shown)
        toastUnlessShownInline(err, shown)
      },
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
        <button type="button" className="btn ghost" onClick={onDone} disabled={update.isPending}>
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

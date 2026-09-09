"use client"

import * as React from "react"
import { SOCIAL_PLATFORM_LABELS } from "@civfix/shared"

import { Icons } from "@/components/icons"
import {
  MAX_ORG_DESCRIPTION,
  MAX_ORG_NAME,
  SOCIAL_PLACEHOLDER,
  SOCIAL_PLATFORMS,
  type OrgProfileDraft,
  type OrgProfileErrors,
  type SocialPlatform,
} from "@/features/orgs/org-form"
import { deriveSlug, publicOrgUrl } from "@/features/orgs/org-slug"

export function FieldError({ text }: { text: string | undefined }) {
  if (!text) return null
  return (
    <span className="field-error" role="alert">
      <Icons.AlertTriangle size={11} /> {text}
    </span>
  )
}

/**
 * The profile fields shared by "New organization" and "Edit profile". In create mode the slug follows
 * the name until the operator edits it by hand; in edit mode the slug never auto-changes and a change
 * is called out because it breaks every existing link to the public page.
 */
export function OrgProfileFields({
  draft,
  errors,
  onChange,
  mode,
  disabled,
}: {
  draft: OrgProfileDraft
  errors: OrgProfileErrors
  onChange: (next: OrgProfileDraft) => void
  mode: "create" | "edit"
  disabled?: boolean
}) {
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit")
  const id = (name: string) => `org-${mode}-${name}`
  const slugPreview = draft.slug.trim().toLowerCase()

  const setName = (name: string) => {
    if (mode === "create" && !slugTouched) onChange({ ...draft, name, slug: deriveSlug(name) })
    else onChange({ ...draft, name })
  }
  const setSocial = (p: SocialPlatform, v: string) =>
    onChange({ ...draft, social: { ...draft.social, [p]: v } })

  return (
    <>
      <div className={`field ${errors.name ? "has-error" : ""}`}>
        <label className="lbl" htmlFor={id("name")}>
          Name
        </label>
        <input
          id={id("name")}
          type="text"
          value={draft.name}
          maxLength={MAX_ORG_NAME}
          placeholder="Friends of Griffith Park"
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
        />
        <FieldError text={errors.name} />
      </div>

      <div className={`field ${errors.slug ? "has-error" : ""}`}>
        <label className="lbl" htmlFor={id("slug")}>
          Slug
          <span className="opt">public address</span>
        </label>
        <div className="slug-input">
          <span className="slug-prefix mono">civfix.org/orgs/</span>
          <input
            id={id("slug")}
            type="text"
            className="mono"
            value={draft.slug}
            spellCheck={false}
            autoCapitalize="none"
            placeholder="friends-of-griffith-park"
            disabled={disabled}
            onChange={(e) => {
              setSlugTouched(true)
              onChange({ ...draft, slug: e.target.value.toLowerCase() })
            }}
          />
          {mode === "create" && slugTouched && draft.name.trim() !== "" && (
            <button
              type="button"
              className="btn sm ghost"
              title="Derive the slug from the name again"
              onClick={() => {
                setSlugTouched(false)
                onChange({ ...draft, slug: deriveSlug(draft.name) })
              }}
            >
              Reset
            </button>
          )}
        </div>
        {errors.slug ? (
          <FieldError text={errors.slug} />
        ) : (
          <span className="hint">
            {slugPreview !== "" ? (
              <>
                Public page: <span className="mono">{publicOrgUrl(slugPreview)}</span>
              </>
            ) : (
              "3–40 lowercase letters, digits and hyphens."
            )}
          </span>
        )}
        {mode === "edit" && (
          <span className="hint tone-warn">
            <Icons.AlertTriangle size={11} /> Changing the slug breaks existing links to the public
            page, QR codes and shared signup pages.
          </span>
        )}
      </div>

      <div className={`field ${errors.description ? "has-error" : ""}`}>
        <label className="lbl" htmlFor={id("description")}>
          Description
          <span className="opt">optional</span>
          <span className="counter mono">
            {draft.description.length}/{MAX_ORG_DESCRIPTION}
          </span>
        </label>
        <textarea
          id={id("description")}
          rows={4}
          value={draft.description}
          maxLength={MAX_ORG_DESCRIPTION}
          placeholder="What the organization does and where it works."
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
        />
        <FieldError text={errors.description} />
      </div>

      <div className={`field ${errors.websiteUrl ? "has-error" : ""}`}>
        <label className="lbl" htmlFor={id("website")}>
          Website
          <span className="opt">optional · https only</span>
        </label>
        <input
          id={id("website")}
          type="url"
          inputMode="url"
          value={draft.websiteUrl}
          placeholder="https://example.org"
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, websiteUrl: e.target.value })}
        />
        <FieldError text={errors.websiteUrl} />
      </div>

      <div className="field">
        <span className="lbl">
          Social links
          <span className="opt">optional · handles, not URLs</span>
        </span>
        <div className="social-grid">
          {SOCIAL_PLATFORMS.map((p) => (
            <div key={p} className={`social-cell ${errors[p] ? "has-error" : ""}`}>
              <label className="social-lbl" htmlFor={id(`social-${p}`)}>
                {SOCIAL_PLATFORM_LABELS[p]}
              </label>
              <div className="slug-input">
                <span className="slug-prefix mono">{p === "whatsapp" ? "+" : "@"}</span>
                <input
                  id={id(`social-${p}`)}
                  type="text"
                  inputMode={p === "whatsapp" ? "tel" : "text"}
                  value={draft.social[p]}
                  placeholder={SOCIAL_PLACEHOLDER[p]}
                  spellCheck={false}
                  autoCapitalize="none"
                  disabled={disabled}
                  onChange={(e) => setSocial(p, e.target.value)}
                />
              </div>
              <FieldError text={errors[p]} />
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export function ReasonField({
  value,
  onChange,
  error,
  placeholder,
  disabled,
  id = "org-reason",
}: {
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder?: string
  disabled?: boolean
  id?: string
}) {
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label className="lbl" htmlFor={id}>
        Reason
        <span className="opt">required · written to the audit log</span>
      </label>
      <textarea
        id={id}
        rows={2}
        value={value}
        maxLength={1000}
        placeholder={placeholder ?? "Why this change is being made…"}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldError text={error} />
    </div>
  )
}

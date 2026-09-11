"use client"

import * as React from "react"
import { SOCIAL_PLATFORM_LABELS, monogram } from "@civfix/shared"

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
import {
  MAX_ORG_LOGO_LABEL,
  ORG_LOGO_ACCEPT,
  logoFileProblem,
  logoUploadErrorMessage,
} from "@/features/orgs/org-logo-upload"
import { deriveSlug, publicOrgUrl } from "@/features/orgs/org-slug"
import { useUploadOrgLogo } from "@/features/orgs/use-orgs"

export function FieldError({ text }: { text: string | undefined }) {
  if (!text) return null
  return (
    <span className="field-error" role="alert">
      <Icons.AlertTriangle size={11} /> {text}
    </span>
  )
}

export function LogoField({
  draft,
  error,
  onChange,
  mode,
  disabled,
  onUploadingChange,
}: {
  draft: OrgProfileDraft
  error: string | undefined
  onChange: (next: OrgProfileDraft) => void
  mode: "create" | "edit"
  disabled?: boolean
  onUploadingChange?: (uploading: boolean) => void
}) {
  const upload = useUploadOrgLogo()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const objectUrlRef = React.useRef<string | null>(null)
  const latest = React.useRef(draft)
  const mounted = React.useRef(true)
  const [problem, setProblem] = React.useState<string | null>(null)

  React.useEffect(() => {
    latest.current = draft
  })
  React.useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])
  const uploading = upload.isPending
  React.useEffect(() => {
    onUploadingChange?.(uploading)
  }, [uploading, onUploadingChange])

  const releasePreview = () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = null
  }

  const onPick = (file: File) => {
    setProblem(null)
    const bad = logoFileProblem(file)
    if (bad) {
      setProblem(bad)
      return
    }
    upload.mutate(file, {
      onSuccess: (logoMediaId) => {
        if (!mounted.current) return
        releasePreview()
        const preview = URL.createObjectURL(file)
        objectUrlRef.current = preview
        onChange({ ...latest.current, logoMediaId, logoPreviewUrl: preview })
      },
      onError: (err) => {
        if (!mounted.current) return
        setProblem(logoUploadErrorMessage(err))
      },
    })
  }

  const onRemove = () => {
    setProblem(null)
    releasePreview()
    onChange({ ...latest.current, logoMediaId: null, logoPreviewUrl: null })
  }

  const busy = !!disabled || uploading
  const hasLogo = draft.logoPreviewUrl !== null || draft.logoMediaId !== null
  const message = problem ?? error
  const inputId = `org-${mode}-logo`

  return (
    <div className={`field ${message ? "has-error" : ""}`}>
      <label className="lbl" htmlFor={inputId}>
        Logo
        <span className="opt">optional · PNG, JPEG or WebP · max {MAX_ORG_LOGO_LABEL}</span>
      </label>
      <div className="org-logo-field">
        {draft.logoPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="org-logo lg" src={draft.logoPreviewUrl} alt="" />
        ) : (
          <span className="org-logo lg hue-sky">{monogram(draft.name)}</span>
        )}
        <div className="org-logo-actions">
          <input
            id={inputId}
            ref={inputRef}
            className="org-logo-file"
            type="file"
            accept={ORG_LOGO_ACCEPT}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null
              e.target.value = ""
              if (file) onPick(file)
            }}
          />
          <button
            type="button"
            className="btn sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Icons.Plus size={13} />{" "}
            {uploading ? "Uploading…" : hasLogo ? "Replace image" : "Upload logo"}
          </button>
          {hasLogo && (
            <button type="button" className="btn sm ghost" disabled={busy} onClick={onRemove}>
              <Icons.Trash size={13} /> Remove
            </button>
          )}
        </div>
      </div>
      {message ? (
        <FieldError text={message} />
      ) : (
        <span className="hint">
          Shown on the public page and next to every event the organization hosts.
        </span>
      )}
    </div>
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
  onLogoUploadingChange,
}: {
  draft: OrgProfileDraft
  errors: OrgProfileErrors
  onChange: (next: OrgProfileDraft) => void
  mode: "create" | "edit"
  disabled?: boolean
  onLogoUploadingChange?: (uploading: boolean) => void
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

      <LogoField
        draft={draft}
        error={errors.logoMediaId}
        onChange={onChange}
        mode={mode}
        disabled={disabled}
        {...(onLogoUploadingChange ? { onUploadingChange: onLogoUploadingChange } : {})}
      />

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

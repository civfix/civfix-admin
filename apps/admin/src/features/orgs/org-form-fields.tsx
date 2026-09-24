"use client"

import * as React from "react"
import {
  MAX_ORG_DESCRIPTION,
  MAX_ORG_NAME,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORMS,
  monogram,
  type SocialPlatform,
} from "@civfix/shared"

import { Icons } from "@/components/icons"
import {
  SOCIAL_PLACEHOLDER,
  type OrgProfileDraft,
  type OrgProfileErrors,
} from "@/features/orgs/org-form"
import {
  MAX_ORG_LOGO_LABEL,
  ORG_LOGO_ACCEPT,
  logoFileProblem,
  logoUploadErrorMessage,
} from "@/features/orgs/org-logo-upload"
import {
  PUBLIC_ORG_URL_LABEL,
  SLUG_RULES_HINT,
  deriveSlug,
  normalizeSlug,
  publicOrgUrl,
} from "@/features/orgs/org-slug"
import { useUploadOrgLogo } from "@/features/orgs/use-orgs"

// Mirrors AdminReasonSchema in @civfix/shared, which exports no constant for it.
const ADMIN_REASON_MAX_LENGTH = 1000
const DESCRIPTION_ROWS = 4
const REASON_ROWS = 2

type FormMode = "create" | "edit"

function orgFieldId(mode: FormMode, name: string): string {
  return `org-${mode}-${name}`
}

export function fieldErrorId(fieldId: string): string {
  return `${fieldId}-error`
}

export function fieldHintId(fieldId: string): string {
  return `${fieldId}-hint`
}

/**
 * The `aria-invalid` / `aria-describedby` pair for a control: described by its error when there is
 * one, else by whichever hints are on screen, so no reference ever points at an unrendered node.
 */
function fieldA11y(
  fieldId: string,
  error: string | null | undefined,
  hintIds: readonly string[] = [],
): { "aria-invalid"?: true; "aria-describedby"?: string } {
  if (error) return { "aria-invalid": true, "aria-describedby": fieldErrorId(fieldId) }
  return hintIds.length > 0 ? { "aria-describedby": hintIds.join(" ") } : {}
}

export function FieldError({ id, text }: { id: string; text: string | null | undefined }) {
  if (!text) return null
  return (
    <span className="field-error" role="alert" id={id}>
      <Icons.AlertTriangle size={11} /> {text}
    </span>
  )
}

interface LogoUploadOptions {
  draft: OrgProfileDraft
  onChange: (next: OrgProfileDraft) => void
  onUploadingChange: ((uploading: boolean) => void) | undefined
}

/**
 * The upload outlives the render that started it, so its result is merged into the latest draft (not
 * the one captured at pick time) and dropped entirely once the field has unmounted.
 */
function useLogoUpload({ draft, onChange, onUploadingChange }: LogoUploadOptions) {
  const upload = useUploadOrgLogo()
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

  const pick = (file: File) => {
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

  const remove = () => {
    setProblem(null)
    releasePreview()
    onChange({ ...latest.current, logoMediaId: null, logoPreviewUrl: null })
  }

  return { uploading, problem, pick, remove }
}

function LogoField({
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
  mode: FormMode
  disabled?: boolean
  onUploadingChange?: (uploading: boolean) => void
}) {
  const { uploading, problem, pick, remove } = useLogoUpload({ draft, onChange, onUploadingChange })
  const inputRef = React.useRef<HTMLInputElement>(null)
  const busy = !!disabled || uploading
  const hasLogo = draft.logoPreviewUrl !== null || draft.logoMediaId !== null
  const message = problem ?? error
  const inputId = orgFieldId(mode, "logo")

  return (
    <div className={`field ${message ? "has-error" : ""}`}>
      <label className="lbl" htmlFor={inputId}>
        Logo
        <span className="opt">optional · PNG, JPEG or WebP · max {MAX_ORG_LOGO_LABEL}</span>
      </label>
      <div className="org-logo-field">
        {draft.logoPreviewUrl ? (
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
            {...fieldA11y(inputId, message, [fieldHintId(inputId)])}
            accept={ORG_LOGO_ACCEPT}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null
              e.target.value = ""
              if (file) pick(file)
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
            <button type="button" className="btn sm ghost" disabled={busy} onClick={remove}>
              <Icons.Trash size={13} /> Remove
            </button>
          )}
        </div>
      </div>
      {message ? (
        <FieldError id={fieldErrorId(inputId)} text={message} />
      ) : (
        <span className="hint" id={fieldHintId(inputId)}>
          Shown on the public page and next to every event the organization hosts.
        </span>
      )}
    </div>
  )
}

interface DraftFieldProps {
  draft: OrgProfileDraft
  errors: OrgProfileErrors
  onChange: (next: OrgProfileDraft) => void
  mode: FormMode
  disabled: boolean | undefined
}

/**
 * In create mode the slug follows the name until the operator edits it by hand; in edit mode the slug
 * never auto-changes and a change is called out because it breaks every existing link to the public
 * page.
 */
function SlugField({
  draft,
  errors,
  onChange,
  mode,
  disabled,
  slugTouched,
  setSlugTouched,
}: DraftFieldProps & { slugTouched: boolean; setSlugTouched: (touched: boolean) => void }) {
  const inputId = orgFieldId(mode, "slug")
  const slugPreview = normalizeSlug(draft.slug)
  const slugWarningId = `${inputId}-warning`
  const slugHintIds = [fieldHintId(inputId), ...(mode === "edit" ? [slugWarningId] : [])]

  return (
    <div className={`field ${errors.slug ? "has-error" : ""}`}>
      <label className="lbl" htmlFor={inputId}>
        Slug
        <span className="opt">public address</span>
      </label>
      <div className="slug-input">
        <span className="slug-prefix mono">{PUBLIC_ORG_URL_LABEL}</span>
        <input
          id={inputId}
          type="text"
          className="mono"
          value={draft.slug}
          spellCheck={false}
          autoCapitalize="none"
          placeholder="friends-of-griffith-park"
          disabled={disabled}
          {...fieldA11y(inputId, errors.slug, slugHintIds)}
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
            disabled={disabled}
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
        <FieldError id={fieldErrorId(inputId)} text={errors.slug} />
      ) : (
        <span className="hint" id={fieldHintId(inputId)}>
          {slugPreview !== "" ? (
            <>
              Public page: <span className="mono">{publicOrgUrl(slugPreview)}</span>
            </>
          ) : (
            SLUG_RULES_HINT
          )}
        </span>
      )}
      {mode === "edit" && (
        <span className="hint tone-warn" id={slugWarningId}>
          <Icons.AlertTriangle size={11} /> Changing the slug breaks existing links to the public
          page, QR codes and shared signup pages.
        </span>
      )}
    </div>
  )
}

function SocialLinksField({ draft, errors, onChange, mode, disabled }: DraftFieldProps) {
  const setSocial = (p: SocialPlatform, v: string) =>
    onChange({ ...draft, social: { ...draft.social, [p]: v } })

  return (
    <div className="field">
      <span className="lbl">
        Social links
        <span className="opt">optional · handles, not URLs</span>
      </span>
      <div className="social-grid">
        {SOCIAL_PLATFORMS.map((p) => {
          const inputId = orgFieldId(mode, `social-${p}`)
          return (
            <div key={p} className={`social-cell ${errors[p] ? "has-error" : ""}`}>
              <label className="social-lbl" htmlFor={inputId}>
                {SOCIAL_PLATFORM_LABELS[p]}
              </label>
              <div className="slug-input">
                <span className="slug-prefix mono">{p === "whatsapp" ? "+" : "@"}</span>
                <input
                  id={inputId}
                  type="text"
                  inputMode={p === "whatsapp" ? "tel" : "text"}
                  value={draft.social[p]}
                  placeholder={SOCIAL_PLACEHOLDER[p]}
                  spellCheck={false}
                  autoCapitalize="none"
                  disabled={disabled}
                  onChange={(e) => setSocial(p, e.target.value)}
                  {...fieldA11y(inputId, errors[p])}
                />
              </div>
              <FieldError id={fieldErrorId(inputId)} text={errors[p]} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
  mode: FormMode
  disabled?: boolean
  onLogoUploadingChange?: (uploading: boolean) => void
}) {
  const [slugTouched, setSlugTouched] = React.useState(mode === "edit")
  const id = (name: string) => orgFieldId(mode, name)
  const fieldProps: DraftFieldProps = { draft, errors, onChange, mode, disabled }

  const setName = (name: string) => {
    if (mode === "create" && !slugTouched) onChange({ ...draft, name, slug: deriveSlug(name) })
    else onChange({ ...draft, name })
  }

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
          {...fieldA11y(id("name"), errors.name)}
        />
        <FieldError id={fieldErrorId(id("name"))} text={errors.name} />
      </div>

      <SlugField {...fieldProps} slugTouched={slugTouched} setSlugTouched={setSlugTouched} />

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
          rows={DESCRIPTION_ROWS}
          value={draft.description}
          maxLength={MAX_ORG_DESCRIPTION}
          placeholder="What the organization does and where it works."
          disabled={disabled}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          {...fieldA11y(id("description"), errors.description)}
        />
        <FieldError id={fieldErrorId(id("description"))} text={errors.description} />
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
          {...fieldA11y(id("website"), errors.websiteUrl)}
        />
        <FieldError id={fieldErrorId(id("website"))} text={errors.websiteUrl} />
      </div>

      <SocialLinksField {...fieldProps} />
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
        rows={REASON_ROWS}
        value={value}
        maxLength={ADMIN_REASON_MAX_LENGTH}
        placeholder={placeholder ?? "Why this change is being made…"}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        {...fieldA11y(id, error)}
      />
      <FieldError id={fieldErrorId(id)} text={error} />
    </div>
  )
}

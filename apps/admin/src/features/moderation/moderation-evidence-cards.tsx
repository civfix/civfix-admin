"use client"

import type { ModerationItemDTO, ModerationSignal } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { isKeyboardActivationKey } from "@/components/shared/keyboard-activation"
import { LightboxSync, openLightbox, type LightboxImage } from "@/components/shared/lightbox"
import { toneClass } from "@/features/moderation/moderation-views"
import { useNav } from "@/store/ui-store"

export function HeldMediaCard({
  media,
  refreshMedia,
}: {
  media: ModerationItemDTO["media"]
  refreshMedia: () => void
}) {
  if (media.length === 0) return null
  const heldImages: LightboxImage[] = media
    .filter((m) => m.kind === "image")
    .map((m, i, images) => ({ id: m.id, url: m.url, alt: `Held image ${i + 1} of ${images.length}` }))
  const heldVideoIds = media.filter((m) => m.kind === "video").map((m) => m.id)
  return (
    <div className="sub">
      <div className="sub-head">Media</div>
      <div className="sub-body" style={{ padding: 10 }}>
        <div className="dsc-msg-media">
          <LightboxSync images={heldImages} />
          {media.map((m) => {
            if (m.kind === "image") {
              const index = heldImages.findIndex((img) => img.id === m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  className="dsc-msg-thumb dsc-msg-thumb-open"
                  title="Expand this image"
                  onClick={() => openLightbox(heldImages, index, refreshMedia)}
                >
                  <img
                    src={m.thumbUrl ?? m.url}
                    alt={heldImages[index]?.alt ?? ""}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              )
            }
            return (
              <a
                key={m.id}
                className="dsc-msg-thumb"
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open this video in a new tab"
                aria-label={`Held video ${heldVideoIds.indexOf(m.id) + 1} of ${heldVideoIds.length}`}
              >
                {m.thumbUrl ? (
                  <img src={m.thumbUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  <Icons.FileText size={14} />
                )}
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SignalCell({ signal }: { signal: ModerationSignal }) {
  return (
    <div className="umr">
      <span>{signal.label}</span>
      <span className={`pill ${toneClass(signal.tone)} tight`}>{signal.val}</span>
    </div>
  )
}

// Signals carry no id and the backend does not promise unique labels, so a repeated label is told
// apart by how many times it appeared before.
function signalKey(signals: readonly ModerationSignal[], index: number): string {
  const label = signals[index]!.label
  const earlier = signals.slice(0, index).filter((s) => s.label === label).length
  return `${label}#${earlier}`
}

export function SignalsCard({ signals }: { signals: readonly ModerationSignal[] }) {
  if (signals.length === 0) return null
  return (
    <div className="sub">
      <div className="sub-head">Signals</div>
      <div className="sub-body">
        <div className="user-meta-rows">
          {signals.map((signal, i, all) => (
            <SignalCell key={signalKey(all, i)} signal={signal} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SimilarItemsCard({ similar }: { similar: ModerationItemDTO["similar"] }) {
  const nav = useNav()
  if (similar.length === 0) return null
  return (
    <div className="sub">
      <div className="sub-head">Similar items</div>
      <div className="sub-body">
        {similar.map((s) => (
          <div
            key={s.id}
            className="prow row-link"
            role="button"
            tabIndex={0}
            title="Open this moderation item"
            onClick={() => nav("moderation", s.id)}
            onKeyDown={(e) => {
              if (!isKeyboardActivationKey(e.key)) return
              e.preventDefault()
              nav("moderation", s.id)
            }}
          >
            <span className="prow-ico hue-lilac">
              <Icons.Layers size={14} />
            </span>
            <div className="prow-body">
              <div className="prow-title">{s.note}</div>
              <div className="prow-meta mono">{s.id}</div>
            </div>
            <span className="prow-age">{s.when}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

"use client"

import { Icons } from "@/components/icons"
import { openLightbox, type LightboxImage } from "@/components/shared/lightbox"

interface ThumbMedia {
  url: string
  thumbUrl?: string | null
}

export function openLightboxAt(images: LightboxImage[], id: string, refresh: () => void): void {
  openLightbox(
    images,
    images.findIndex((i) => i.id === id),
    refresh,
  )
}

export function ImageThumbButton({ media, onOpen }: { media: ThumbMedia; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="dsc-msg-thumb dsc-msg-thumb-open"
      title="Expand this photo"
      onClick={onOpen}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={media.thumbUrl ?? media.url} alt="" loading="lazy" decoding="async" />
    </button>
  )
}

export function StillThumbFace({ thumbUrl }: { thumbUrl?: string | null }) {
  return thumbUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={thumbUrl} alt="" loading="lazy" decoding="async" />
  ) : (
    <Icons.FileText size={14} />
  )
}

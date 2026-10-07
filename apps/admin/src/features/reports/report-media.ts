import type { AdminReportDTO } from "@civfix/shared"

import type { LightboxImage } from "@/components/shared/lightbox"

type ReportMedia = AdminReportDTO["media"][number]

export interface ReportMediaView {
  preview: ReportMedia | null
  gallery: ReportMedia[]
  lightboxImages: LightboxImage[]
}

// Only an image may be the preview: the preview face opens the lightbox, which shows images only, so a
// video placed there would have no way to be played.
export function reportMediaView(media: readonly ReportMedia[], title: string): ReportMediaView {
  const preview = media.find((m) => m.kind === "image") ?? null
  return {
    preview,
    gallery: media.filter((m) => m.id !== preview?.id),
    lightboxImages: media
      .filter((m) => m.kind === "image")
      .map((m) => ({ id: m.id, url: m.url, alt: `Photo on ${title}` })),
  }
}

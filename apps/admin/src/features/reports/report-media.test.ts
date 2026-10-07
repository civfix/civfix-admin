import type { AdminReportDTO } from "@civfix/shared"
import { describe, expect, it } from "vitest"

import { reportMediaView } from "./report-media"

type Media = AdminReportDTO["media"][number]

const IMAGE_A: Media = { id: "m-a", kind: "image", url: "https://media.test/a.jpg", thumbUrl: "https://media.test/a-t.jpg" }
const IMAGE_B: Media = { id: "m-b", kind: "image", url: "https://media.test/b.jpg" }
const VIDEO: Media = { id: "m-v", kind: "video", url: "https://media.test/v.mp4", thumbUrl: "https://media.test/v.jpg" }

describe("reportMediaView", () => {
  it("has no preview, gallery or lightbox without media", () => {
    expect(reportMediaView([], "Couch")).toEqual({ preview: null, gallery: [], lightboxImages: [] })
  })

  it("previews a lone image and leaves the gallery empty", () => {
    const view = reportMediaView([IMAGE_A], "Couch")
    expect(view.preview).toBe(IMAGE_A)
    expect(view.gallery).toEqual([])
    expect(view.lightboxImages).toEqual([{ id: "m-a", url: IMAGE_A.url, alt: "Photo on Couch" }])
  })

  it("previews the image and keeps the video in the gallery", () => {
    const view = reportMediaView([VIDEO, IMAGE_A], "Couch")
    expect(view.preview).toBe(IMAGE_A)
    expect(view.gallery).toEqual([VIDEO])
    expect(view.lightboxImages.map((i) => i.id)).toEqual(["m-a"])
  })

  it("never previews a video, so a video-only report keeps it reachable in the gallery", () => {
    const view = reportMediaView([VIDEO], "Couch")
    expect(view.preview).toBeNull()
    expect(view.gallery).toEqual([VIDEO])
    expect(view.lightboxImages).toEqual([])
  })

  it("previews the first image and opens the second at its lightbox index", () => {
    const view = reportMediaView([IMAGE_A, IMAGE_B], "Couch")
    expect(view.preview).toBe(IMAGE_A)
    expect(view.gallery).toEqual([IMAGE_B])
    expect(view.lightboxImages.findIndex((i) => i.id === IMAGE_B.id)).toBe(1)
  })
})

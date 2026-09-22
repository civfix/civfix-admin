"use client"

import * as React from "react"
import { create } from "zustand"

import { Icons } from "@/components/icons"
import { useModalFocus } from "@/components/shared/modal-focus"

export interface LightboxImage {
  id: string
  url: string
  alt: string
}

export function stepIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0
  return (((index + delta) % count) + count) % count
}

export function startIndex(index: number, count: number): number {
  return index >= 0 && index < count ? index : 0
}

interface LightboxState {
  images: LightboxImage[]
  index: number
  refresh: (() => void) | null
  open: (images: LightboxImage[], index: number, refresh: (() => void) | null) => void
  close: () => void
  step: (delta: number) => void
  sync: (images: LightboxImage[]) => void
}

const useLightboxStore = create<LightboxState>((set) => ({
  images: [],
  index: 0,
  refresh: null,
  open: (images, index, refresh) => set({ images, index, refresh }),
  close: () => set({ images: [], index: 0, refresh: null }),
  step: (delta) =>
    set((s) => (s.images.length === 0 ? s : { index: stepIndex(s.index, delta, s.images.length) })),
  sync: (images) =>
    set((s) => {
      if (s.images.length === 0) return s
      const next = s.images.map((shown) => images.find((i) => i.id === shown.id) ?? shown)
      return next.every((img, i) => img.url === s.images[i]?.url) ? s : { images: next }
    }),
}))

export function openLightbox(images: LightboxImage[], index = 0, refresh?: () => void): void {
  if (images.length === 0) return
  useLightboxStore.getState().open(images, startIndex(index, images.length), refresh ?? null)
}

export function LightboxSync({ images }: { images: LightboxImage[] }) {
  React.useEffect(() => {
    useLightboxStore.getState().sync(images)
  }, [images])
  return null
}

export function LightboxHost() {
  const images = useLightboxStore((s) => s.images)
  const index = useLightboxStore((s) => s.index)
  const refresh = useLightboxStore((s) => s.refresh)
  const close = useLightboxStore((s) => s.close)
  const step = useLightboxStore((s) => s.step)
  const count = images.length
  const frameRef = useModalFocus<HTMLDivElement>(count > 0)
  const current = count > 0 ? (images[index] ?? images[0]) : undefined
  const url = current?.url ?? null
  const [load, setLoad] = React.useState<{
    url: string | null
    status: "loading" | "ready" | "failed"
    attempt: number
  }>({ url: null, status: "loading", attempt: 0 })
  const forCurrent = load.url === url
  const status = forCurrent ? load.status : "loading"
  const attempt = forCurrent ? load.attempt : 0

  React.useEffect(() => {
    if (count === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        close()
      } else if (e.key === "ArrowRight" && count > 1) {
        e.preventDefault()
        step(1)
      } else if (e.key === "ArrowLeft" && count > 1) {
        e.preventDefault()
        step(-1)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [count, close, step])

  if (!current) return null
  const many = count > 1

  const retry = () => {
    setLoad({ url: current.url, status: "loading", attempt: attempt + 1 })
    refresh?.()
  }

  return (
    <div className="modal-overlay lightbox-overlay" onClick={close}>
      <div
        ref={frameRef}
        className="lightbox"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={current.alt}
      >
        <div className="lightbox-bar">
          {many && (
            <span className="lightbox-count mono">
              {index + 1} / {count}
            </span>
          )}
          <button className="lightbox-btn" onClick={close} aria-label="Close">
            <Icons.X size={16} />
          </button>
        </div>
        {status !== "failed" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${current.id}:${attempt}`}
            className={`lightbox-img ${status === "ready" ? "" : "pending"}`}
            src={current.url}
            alt={current.alt}
            decoding="async"
            onLoad={() => setLoad({ url: current.url, status: "ready", attempt })}
            onError={() => setLoad({ url: current.url, status: "failed", attempt })}
          />
        )}
        {status === "loading" && (
          <div className="lightbox-face" role="status" aria-live="polite">
            <span className="op-spin" aria-hidden="true" />
            <span>Loading photo...</span>
          </div>
        )}
        {status === "failed" && (
          <div className="lightbox-face" role="alert">
            <span className="lightbox-face-title">This photo link expired</span>
            <span className="lightbox-face-sub">
              Photo links are short-lived. Refresh to fetch a new one.
            </span>
            <button type="button" className="lightbox-face-btn" onClick={retry}>
              Refresh photo
            </button>
          </div>
        )}
        {many && (
          <>
            <button
              className="lightbox-btn lightbox-prev"
              onClick={() => step(-1)}
              aria-label="Previous photo"
            >
              <Icons.ChevronLeft size={20} />
            </button>
            <button
              className="lightbox-btn lightbox-next"
              onClick={() => step(1)}
              aria-label="Next photo"
            >
              <Icons.ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

"use client"

import * as React from "react"
import { create } from "zustand"

import { Icons } from "@/components/icons"

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
  open: (images: LightboxImage[], index: number) => void
  close: () => void
  step: (delta: number) => void
}

const useLightboxStore = create<LightboxState>((set) => ({
  images: [],
  index: 0,
  open: (images, index) => set({ images, index }),
  close: () => set({ images: [], index: 0 }),
  step: (delta) =>
    set((s) => (s.images.length === 0 ? s : { index: stepIndex(s.index, delta, s.images.length) })),
}))

export function openLightbox(images: LightboxImage[], index = 0): void {
  if (images.length === 0) return
  useLightboxStore.getState().open(images, startIndex(index, images.length))
}

export function LightboxHost() {
  const images = useLightboxStore((s) => s.images)
  const index = useLightboxStore((s) => s.index)
  const close = useLightboxStore((s) => s.close)
  const step = useLightboxStore((s) => s.step)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const count = images.length

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

  React.useEffect(() => {
    if (count > 0) closeRef.current?.focus()
  }, [count])

  if (count === 0) return null
  const current = images[index] ?? images[0]
  if (!current) return null
  const many = count > 1

  return (
    <div className="modal-overlay lightbox-overlay" onClick={close}>
      <div
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
          <button ref={closeRef} className="lightbox-btn" onClick={close} aria-label="Close">
            <Icons.X size={16} />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="lightbox-img" src={current.url} alt={current.alt} />
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

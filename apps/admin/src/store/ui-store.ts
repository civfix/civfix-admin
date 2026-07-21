"use client"

import { create } from "zustand"

export const SECTIONS = [
  "discovery",
  "reports",
  "events",
  "mail",
  "users",
  "moderation",
  "analytics",
] as const

export type SectionId = (typeof SECTIONS)[number]
export type PageId = "home" | SectionId

export const PAGE_LABEL: Record<PageId, string> = {
  home: "Dashboard",
  discovery: "Jurisdictions",
  reports: "Reports",
  events: "Events",
  mail: "Mail",
  users: "Users",
  moderation: "Moderation",
  analytics: "Analytics",
}

export interface Toast {
  id: number
  text: string
}

interface UiState {
  page: PageId
  focusId: string | null
  toast: Toast | null

  nav: (page: PageId, focusId?: string | null) => void
  syncFromHash: () => void
  showToast: (text: string) => void
  dismissToast: () => void
}

let toastSeq = 0

function parseHash(): { page: PageId; focusId: string | null } {
  if (typeof window === "undefined") return { page: "home", focusId: null }
  const raw = window.location.hash.replace(/^#\/?/, "")
  const [seg = "", ...rest] = raw.split("/")
  const page: PageId = (SECTIONS as readonly string[]).includes(seg) ? (seg as PageId) : "home"
  const focusId = page !== "home" && rest.length > 0 ? decodeURIComponent(rest.join("/")) : null
  return { page, focusId }
}

function hashFor(page: PageId, focusId: string | null): string {
  if (page === "home") return "#/"
  return focusId ? `#/${page}/${encodeURIComponent(focusId)}` : `#/${page}`
}

const initialRoute = parseHash()

export const useUiStore = create<UiState>((set) => ({
  page: initialRoute.page,
  focusId: initialRoute.focusId,
  toast: null,

  nav: (page, focusId = null) => {
    set({ page, focusId })
    if (typeof window !== "undefined") {
      const next = hashFor(page, focusId)
      if (window.location.hash !== next) window.history.pushState(null, "", next)
      window.scrollTo(0, 0)
    }
  },

  syncFromHash: () => set(parseHash()),

  showToast: (text) => set({ toast: { id: ++toastSeq, text } }),

  dismissToast: () => set({ toast: null }),
}))

export function useNav(): UiState["nav"] {
  return useUiStore((s) => s.nav)
}

export function useToast(): (text: string) => void {
  return useUiStore((s) => s.showToast)
}

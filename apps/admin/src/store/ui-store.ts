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
  "orgs",
  "hosts",
  "pages",
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
  orgs: "Organizations",
  hosts: "Host messaging",
  pages: "Signup pages",
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

interface Route {
  page: PageId
  focusId: string | null
}

const HOME_ROUTE: Route = { page: "home", focusId: null }

// The hash comes from whatever link the operator opened, and this runs at import and on popstate, so a
// malformed escape must degrade to home rather than throw and leave the app unrendered.
function decodeFocus(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}

function parseHash(): Route {
  if (typeof window === "undefined") return HOME_ROUTE
  const raw = window.location.hash.replace(/^#\/?/, "")
  const [seg = "", ...rest] = raw.split("/")
  const page: PageId = (SECTIONS as readonly string[]).includes(seg) ? (seg as PageId) : "home"
  if (page === "home" || rest.length === 0) return { page, focusId: null }
  const focusId = decodeFocus(rest.join("/"))
  return focusId === null ? HOME_ROUTE : { page, focusId }
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

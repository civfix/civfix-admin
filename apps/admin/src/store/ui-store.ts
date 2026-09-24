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

export type ToastTone = "ok" | "error"

interface Toast {
  id: number
  text: string
  tone: ToastTone
}

interface UiState {
  page: PageId
  focusId: string | null
  toast: Toast | null

  nav: (page: PageId, focusId?: string | null) => void
  syncFromHash: () => void
  showToast: (text: string, tone?: ToastTone) => void
  dismissToast: () => void
}

let toastSeq = 0

interface Route {
  page: PageId
  focusId: string | null
}

const HOME_ROUTE: Route = { page: "home", focusId: null }
const HOME_HASH = "#/"
const HASH_ROUTE_PREFIX = /^#\/?/

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
  const [path = ""] = window.location.hash.replace(HASH_ROUTE_PREFIX, "").split("?")
  const [seg = "", ...rest] = path.split("/")
  const page: PageId = (SECTIONS as readonly string[]).includes(seg) ? (seg as PageId) : "home"
  const encodedFocus = rest.join("/")
  if (page === "home" || encodedFocus === "") return { page, focusId: null }
  const focusId = decodeFocus(encodedFocus)
  return focusId === null ? HOME_ROUTE : { page, focusId }
}

function hashFor(page: PageId, focusId: string | null): string {
  if (page === "home") return HOME_HASH
  return focusId ? `#/${page}/${encodeURIComponent(focusId)}` : `#/${page}`
}

const initialRoute = parseHash()

export const useUiStore = create<UiState>((set) => ({
  page: initialRoute.page,
  focusId: initialRoute.focusId,
  toast: null,

  nav: (page, requestedFocus = null) => {
    const focusId = page === "home" ? null : requestedFocus || null
    set({ page, focusId })
    if (typeof window !== "undefined") {
      const next = hashFor(page, focusId)
      if (window.location.hash !== next) window.history.pushState(null, "", next)
      window.scrollTo(0, 0)
    }
  },

  syncFromHash: () => set(parseHash()),

  showToast: (text, tone = "ok") => set({ toast: { id: ++toastSeq, text, tone } }),

  dismissToast: () => set({ toast: null }),
}))

export function useNav(): UiState["nav"] {
  return useUiStore((s) => s.nav)
}

export function useToast(): UiState["showToast"] {
  return useUiStore((s) => s.showToast)
}

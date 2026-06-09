"use client"

import { create } from "zustand"

/**
 * Cross-cutting client UI state for the dashboard shell. Replaces the prototype's `window.__toast`,
 * `window.__nav`, and `window.__navOpen` globals (app.jsx) with a typed store so any component
 * (the live map, home cards, section pages) can drive navigation and toasts without globals.
 *
 * The set of routable sections. `home` is the hub. (The prototype also defined `moderation` and
 * `government`, but the design has no screens for them and nothing in the UI navigates there, so they
 * are not surfaced as routes; the feature files remain orphaned in place.)
 */
export const SECTIONS = [
  "discovery",
  "reports",
  "events",
  "mail",
  "inbox",
  "users",
  "analytics",
] as const

export type SectionId = (typeof SECTIONS)[number]
export type PageId = "home" | SectionId

/** User-facing label per page. Note: route id `discovery` shows as "Jurisdictions" everywhere. */
export const PAGE_LABEL: Record<PageId, string> = {
  home: "Dashboard",
  discovery: "Jurisdictions",
  reports: "Reports",
  events: "Events",
  mail: "Mail",
  inbox: "Inbox",
  users: "Users",
  analytics: "Analytics",
}

export interface Toast {
  id: number
  text: string
}

interface UiState {
  /** Current page in the client-rooted shell. */
  page: PageId
  /** The entry id to focus/open inside a section page (deep-link target), or null. */
  focusId: string | null
  /** The active ephemeral toast, or null. */
  toast: Toast | null

  /** Navigate to a page, optionally focusing an entry id. Scrolls to top. */
  nav: (page: PageId, focusId?: string | null) => void
  /** Show a transient confirmation toast (auto-dismisses on a timer set by the Toast component). */
  showToast: (text: string) => void
  /** Dismiss the current toast. */
  dismissToast: () => void
}

let toastSeq = 0

export const useUiStore = create<UiState>((set) => ({
  page: "home",
  focusId: null,
  toast: null,

  nav: (page, focusId = null) => {
    set({ page, focusId })
    if (typeof window !== "undefined") window.scrollTo(0, 0)
  },

  showToast: (text) => set({ toast: { id: ++toastSeq, text } }),

  dismissToast: () => set({ toast: null }),
}))

/** Hook: the navigation callback (stable reference across renders). */
export function useNav(): UiState["nav"] {
  return useUiStore((s) => s.nav)
}

/**
 * Hook: a toast trigger, matching the design's `window.__toast(text)`. Fire after a successful write
 * (save contact, change status, send reply, ...). Returns a stable callback.
 */
export function useToast(): (text: string) => void {
  return useUiStore((s) => s.showToast)
}

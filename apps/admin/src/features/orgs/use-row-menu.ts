"use client"

import * as React from "react"

import { menuFocusIndex } from "@/features/orgs/org-members"

const MENU_VIEWPORT_MARGIN_PX = 8
// Only decides when to flip upward; the menu's real height is whatever its items need.
const MENU_EST_HEIGHT_PX = 220
const MENU_GAP_PX = 4
const FOCUS_OPTIONS: FocusOptions = { preventScroll: true }

export interface RowMenuPosition {
  top?: number
  bottom?: number
  right: number
}

function menuPositionFor(rect: DOMRect): RowMenuPosition {
  const right = Math.max(MENU_VIEWPORT_MARGIN_PX, window.innerWidth - rect.right)
  const flipUp = rect.bottom + MENU_EST_HEIGHT_PX > window.innerHeight
  return flipUp
    ? { bottom: window.innerHeight - rect.top + MENU_GAP_PX, right }
    : { top: rect.bottom + MENU_GAP_PX, right }
}

function menuItemsIn(pop: HTMLElement | null): HTMLButtonElement[] {
  return Array.from(pop?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
}

/**
 * The menu is position:fixed (anchored to the trigger's rect) so the card's overflow:hidden and the
 * roster's rounded clip cannot cut it off; it flips upward when the trigger is near the bottom.
 *
 * A real menu: the first item takes focus on open; arrows/Home/End move (wrapping), Escape closes
 * and returns focus to the trigger, and focus leaving the menu (Tab, a click elsewhere) closes it.
 */
export function useRowMenu() {
  const [position, setPosition] = React.useState<RowMenuPosition | null>(null)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const popRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const open = position !== null

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition(menuPositionFor(rect))
  }
  const close = React.useCallback((returnFocus: boolean) => {
    setPosition(null)
    if (returnFocus) triggerRef.current?.focus(FOCUS_OPTIONS)
  }, [])

  React.useEffect(() => {
    if (!open) return
    menuItemsIn(popRef.current)[0]?.focus(FOCUS_OPTIONS)
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      // The menu owns this Escape: nothing above it (the shell's go-home) should also react.
      e.preventDefault()
      e.stopPropagation()
      close(true)
    }
    const onScroll = () => close(false)
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onScroll)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onScroll)
    }
  }, [open, close])

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = menuItemsIn(popRef.current)
    const current = items.findIndex((el) => el === document.activeElement)
    const next = menuFocusIndex(e.key, current, items.length)
    if (next === null) return
    e.preventDefault()
    items[next]?.focus(FOCUS_OPTIONS)
  }
  const onMenuBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const to = e.relatedTarget as Node | null
    if (!to || !wrapRef.current?.contains(to)) close(false)
  }
  const toggle = () => (open ? close(false) : openMenu())
  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    // ArrowDown on a closed menu button opens it (WAI-ARIA menu-button pattern).
    if (open || e.key !== "ArrowDown") return
    e.preventDefault()
    openMenu()
  }

  return {
    open,
    position,
    close,
    toggle,
    wrapRef,
    popRef,
    triggerRef,
    onMenuKeyDown,
    onMenuBlur,
    onTriggerKeyDown,
  }
}

export type RowMenu = ReturnType<typeof useRowMenu>

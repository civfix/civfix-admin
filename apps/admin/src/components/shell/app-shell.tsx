"use client"

import * as React from "react"

import { BackBar } from "@/components/shell/back-bar"
import { Toast } from "@/components/shell/toast"
import { PAGE_REGISTRY, type SectionPageProps } from "@/components/shell/page-registry"
import { LoadingState } from "@/components/shared/data-states"
import { useUiStore, type SectionId } from "@/store/ui-store"

/**
 * The client-rooted dashboard shell (ported from app.jsx). There is no global top bar or sidebar: the
 * home/dashboard is the hub, sections expand from it, and a slim BackBar returns home. Because this is
 * a static export (output:"export"), routing is entirely client-side page state in the UI store - not
 * Next routes. `key={page}` on <main> forces a remount per route (matching the prototype). Esc returns
 * to the dashboard from any section page.
 *
 * The prototype exposed nav on window (`__nav`, `__navOpen`); those are now the UI store's `nav` action
 * (see src/store/ui-store.ts) so the live map and home cards deep-link without globals.
 */
export function AppShell() {
  const page = useUiStore((s) => s.page)
  const focusId = useUiStore((s) => s.focusId)
  const nav = useUiStore((s) => s.nav)

  // Keyboard: Esc returns to the dashboard from any section page, unless focus is in a form control.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (page !== "home" && e.key === "Escape") {
        e.preventDefault()
        nav("home")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [page, nav])

  const PageComponent = PAGE_REGISTRY[page]
  const isHome = page === "home"
  const pageProps: SectionPageProps = { focusId }

  return (
    <div className="shell-flat">
      <main className={`main ${isHome ? "main-home" : ""}`} key={page}>
        {!isHome && <BackBar page={page as SectionId} />}
        <React.Suspense fallback={<LoadingState label="Loading..." />}>
          <PageComponent {...pageProps} />
        </React.Suspense>
      </main>

      <Toast />
    </div>
  )
}

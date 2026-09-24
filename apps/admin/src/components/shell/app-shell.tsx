"use client"

import * as React from "react"

import { BackBar } from "@/components/shell/back-bar"
import { ErrorBoundary } from "@/components/shell/error-boundary"
import { shellEscapeGoesHome } from "@/components/shell/escape-owner"
import { SourceFooter } from "@/components/shell/source-footer"
import { Toast } from "@/components/shell/toast"
import { DialogHost } from "@/components/shared/dialog"
import { LightboxHost } from "@/components/shared/lightbox"
import { PAGE_REGISTRY, type SectionPageProps } from "@/components/shell/page-registry"
import { LoadingState } from "@/components/shared/data-states"
import { useUiStore, type SectionId } from "@/store/ui-store"

export function AppShell() {
  const page = useUiStore((s) => s.page)
  const focusId = useUiStore((s) => s.focusId)
  const nav = useUiStore((s) => s.nav)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement | null)?.tagName
      // An open slide-over, row menu or dialog owns Escape (it closes itself); the shell only goes
      // home when nothing is layered over the page.
      if (!shellEscapeGoesHome({ key: e.key, page, targetTag, doc: document })) return
      e.preventDefault()
      nav("home")
    }
    // Capture phase: the layer's own Escape handler (on document or window) runs later and closes
    // it, and React flushes that removal at the microtask checkpoint between listeners — a bubble-
    // phase check here would already find the layer gone and go home on top of closing it.
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [page, nav])

  React.useEffect(() => {
    const onPop = () => useUiStore.getState().syncFromHash()
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  const PageComponent = PAGE_REGISTRY[page]
  const isHome = page === "home"
  const pageProps: SectionPageProps = { focusId }

  return (
    <div className="shell-flat">
      <main className={`main ${isHome ? "main-home" : ""}`} key={page}>
        {!isHome && <BackBar page={page as SectionId} />}
        <ErrorBoundary>
          <React.Suspense fallback={<LoadingState label="Loading..." />}>
            <PageComponent {...pageProps} />
          </React.Suspense>
        </ErrorBoundary>
        {!isHome && <SourceFooter />}
      </main>

      <Toast />
      <DialogHost />
      <LightboxHost />
    </div>
  )
}

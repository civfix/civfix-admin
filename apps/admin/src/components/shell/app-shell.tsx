"use client"

import * as React from "react"

import { BackBar } from "@/components/shell/back-bar"
import { Toast } from "@/components/shell/toast"
import { DialogHost } from "@/components/shared/dialog"
import { PAGE_REGISTRY, type SectionPageProps } from "@/components/shell/page-registry"
import { LoadingState } from "@/components/shared/data-states"
import { useUiStore, type SectionId } from "@/store/ui-store"

export function AppShell() {
  const page = useUiStore((s) => s.page)
  const focusId = useUiStore((s) => s.focusId)
  const nav = useUiStore((s) => s.nav)

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
        <React.Suspense fallback={<LoadingState label="Loading..." />}>
          <PageComponent {...pageProps} />
        </React.Suspense>
      </main>

      <Toast />
      <DialogHost />
    </div>
  )
}

import { onTestFinished, vi } from "vitest"

import { useUiStore, type ToastTone } from "@/store/ui-store"

export function spyToasts() {
  const original = useUiStore.getState().showToast
  const showToast = vi.fn<(text: string, tone?: ToastTone) => void>()
  useUiStore.setState({ showToast })
  onTestFinished(() => useUiStore.setState({ showToast: original }))
  return showToast
}

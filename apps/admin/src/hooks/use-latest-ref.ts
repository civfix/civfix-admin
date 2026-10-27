"use client"

import * as React from "react"

/**
 * A ref that always holds the latest committed `value`, for handlers bound once (map markers, a
 * mount-only effect) that must call the current callback without re-binding.
 */
export function useLatestRef<T>(value: T): React.RefObject<T> {
  const ref = React.useRef(value)
  React.useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}

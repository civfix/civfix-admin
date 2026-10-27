"use client"

import * as React from "react"

/**
 * True for the render in which `value` differs from the previous render's, so a caller can reset
 * state derived from it while rendering instead of in an effect that paints the stale state first.
 */
export function useValueChanged<T>(value: T): boolean {
  const [previous, setPrevious] = React.useState(value)
  if (Object.is(previous, value)) return false
  setPrevious(value)
  return true
}

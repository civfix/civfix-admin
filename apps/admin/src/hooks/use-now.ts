"use client"

import * as React from "react"

import { MINUTE_MS } from "@/lib/timing"

export function useNow(intervalMs = MINUTE_MS): number {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

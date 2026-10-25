"use client"

import * as React from "react"

import { confirmDialog } from "@/components/shared/dialog"
import { useDevEnvironment } from "@/features/dev/use-dev"

/**
 * Asks before a change. On production the button names it ("Run on production") in the danger style,
 * so a change never lands there by habit.
 */
export function useDevConfirm() {
  const environment = useDevEnvironment()
  return React.useCallback(
    ({ title, details, verb }: { title: string; details?: string[]; verb: "Run" | "Change" }) => {
      const onProduction = environment === "prod"
      return confirmDialog({
        title,
        details,
        confirmLabel: onProduction ? `${verb} on production` : verb,
        danger: onProduction,
      })
    },
    [environment],
  )
}

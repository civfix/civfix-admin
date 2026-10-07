"use client"

import * as React from "react"

import { useOperatorBootstrap } from "@/hooks/use-admin-auth"

export function AuthHydrator() {
  const bootstrap = useOperatorBootstrap()

  React.useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  return null
}

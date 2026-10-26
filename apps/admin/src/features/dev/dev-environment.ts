import type { AdminDevEnvironment } from "@civfix/contract"

export const ENVIRONMENT_LABEL: Record<AdminDevEnvironment, string> = {
  prod: "Production",
  staging: "Staging",
  local: "Local",
  unknown: "Unknown",
}

export const ENVIRONMENT_TONE: Record<AdminDevEnvironment, string> = {
  prod: "env-prod",
  staging: "env-staging",
  local: "env-neutral",
  unknown: "env-neutral",
}

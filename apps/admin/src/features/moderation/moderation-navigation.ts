import type { ModerationDestinationKind } from "@civfix/shared"

import type { PageId } from "@/store/ui-store"

export function getModerationDestination(
  kind: ModerationDestinationKind | null | undefined,
  id: string | null | undefined,
): { page: PageId; id: string } | null {
  if (!kind || !id) return null
  if (kind === "report") return { page: "reports", id }
  if (kind === "event") return { page: "events", id }
  return { page: "users", id }
}

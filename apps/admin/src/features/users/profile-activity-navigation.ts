type UserMessageDestination = { page: "events" | "reports"; id: string }

export function userMessageDestination(input: {
  source?: string | null
  sourceId: string | null
}): UserMessageDestination | null {
  if (!input.sourceId) return null
  if (input.source === "chat") return { page: "events", id: input.sourceId }
  if (input.source === "report") return { page: "reports", id: input.sourceId }
  return null
}

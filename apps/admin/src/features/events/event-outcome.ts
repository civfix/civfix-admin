import { SetEventOutcomeRequestSchema } from "@civfix/shared"

export function parseBags(input: string): number | null {
  if (input.trim() === "") return null
  const parsed = SetEventOutcomeRequestSchema.shape.bags.safeParse(Number(input))
  return parsed.success ? parsed.data : null
}

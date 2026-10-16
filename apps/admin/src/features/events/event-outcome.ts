import { SetEventOutcomeRequestSchema } from "@civfix/contract"

export function parseBags(input: string): number | null {
  if (input.trim() === "") return null
  const parsed = SetEventOutcomeRequestSchema.shape.bags.safeParse(Number(input))
  return parsed.success ? parsed.data : null
}

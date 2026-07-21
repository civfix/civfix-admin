export function getReporterProfileId(id: string | null): string | null {
  const normalized = id?.trim() ?? ""
  return normalized === "" ? null : normalized
}

/**
 * The `q` the admin users search sends for what the operator typed, or undefined when there is nothing
 * to search. The API matches name, handle and city; handles are stored without the `@` people type in
 * front of them, so a leading `@` would match nothing.
 */
export function userSearchTerm(raw: string): string | undefined {
  const term = raw.trim().replace(/^@/, "").trim()
  return term === "" ? undefined : term
}

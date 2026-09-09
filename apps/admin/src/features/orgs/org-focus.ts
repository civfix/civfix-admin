export const ORG_DETAIL_TABS = ["profile", "verification", "members", "events", "payments"] as const
export type OrgDetailTab = (typeof ORG_DETAIL_TABS)[number]

/**
 * The orgs section focus is `<id>` or `<id>/<tab>` (the hash router joins everything after the section
 * into one focus string), so another section can deep-link straight to e.g. the Payments tab:
 * `nav("orgs", orgFocus(id, "payments"))`. An unknown tab falls back to null (caller keeps its default).
 */
export function parseOrgFocus(focusId: string | null): { id: string | null; tab: OrgDetailTab | null } {
  if (!focusId) return { id: null, tab: null }
  const [id = "", rest = ""] = focusId.split("/", 2)
  const tab = (ORG_DETAIL_TABS as readonly string[]).includes(rest) ? (rest as OrgDetailTab) : null
  return { id: id === "" ? null : id, tab }
}

export function orgFocus(id: string, tab?: OrgDetailTab): string {
  return tab ? `${id}/${tab}` : id
}

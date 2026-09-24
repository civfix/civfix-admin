"use client"

import { Icons } from "@/components/icons"
import { SOURCE } from "@/lib/source"

// The abbreviation GitHub shows for a commit, so the footer matches the linked page.
const SHORT_COMMIT_LENGTH = 7

/** The AGPL-3.0 section 13 source offer: a link to the repository at the deployed commit. */
export function SourceFooter() {
  return (
    <footer className="hub-foot">
      <a href={SOURCE.url} target="_blank" rel="noreferrer noopener">
        <Icons.ExternalLink size={12} /> Source code (AGPL-3.0)
      </a>
      {SOURCE.commit ? <span className="hub-foot-commit">{SOURCE.commit.slice(0, SHORT_COMMIT_LENGTH)}</span> : null}
    </footer>
  )
}

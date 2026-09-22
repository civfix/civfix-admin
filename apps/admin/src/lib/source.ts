export const SOURCE_REPO_URL = "https://github.com/civfix/civfix-admin"

const COMMIT_SHA = /^[0-9a-f]{7,40}$/i

export type SourceLink = { commit: string; url: string }

export function sourceLink(rawCommit: string | undefined): SourceLink {
  const commit = rawCommit && COMMIT_SHA.test(rawCommit) ? rawCommit.toLowerCase() : ""
  return { commit, url: commit ? `${SOURCE_REPO_URL}/tree/${commit}` : SOURCE_REPO_URL }
}

export const SOURCE: SourceLink = sourceLink(process.env.NEXT_PUBLIC_COMMIT_SHA)

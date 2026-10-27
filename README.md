# civfix-admin

Workspace for the civfix ADMIN / OPERATOR dashboard, served at `admin.civfix.org`. A pnpm + Turbo
monorepo. This is the internal tool operators use to triage reports, route jurisdiction contacts,
moderate content, run mail outreach, provision government accounts, and read analytics. Its siblings
are `civfix-contract` (the `@civfix/contract` API contract), `civfix-app` (community web + mobile, and the `@civfix/tokens` design tokens), `civfix-backend` (the
API it calls) and `civfix-infra` (the edge that serves it).

## Layout

```
civfix-admin/
  apps/admin/           # the operator dashboard (Next.js 15 static-export SPA). See its source.
  .npmrc                # @civfix:registry=https://repo.civfix.org/ (installs @civfix/contract and @civfix/tokens)
  pnpm-workspace.yaml   # workspace packages (apps/*) and every pnpm setting (overrides, build allow-list, supply-chain gates)
  turbo.json            # build/typecheck/lint task graph
  wrangler.jsonc        # Cloudflare Pages project "civfix-admin" -> apps/admin/out -> admin.civfix.org
```

`@civfix/contract` (the API contract, from civfix-contract) and `@civfix/tokens` (the design tokens,
from civfix-app) are installed from the private Verdaccio registry at `https://repo.civfix.org`. The
repo-root `.npmrc` scopes `@civfix` to it and the app depends on published versions by caret range (see
`apps/admin/package.json`); the registry allows anonymous read, so no credentials are needed. After
cloning, `pnpm install` fetches them. The published tarballs already contain the built `dist`, so no
local build is required.

## Commands (from this root)

```
pnpm install      # fetches @civfix/contract and @civfix/tokens from repo.civfix.org
pnpm build        # admin (next build, static export -> apps/admin/out)
pnpm typecheck
pnpm lint         # eslint (flat config, typed rules) over apps/admin
pnpm test         # vitest unit tests; any unexpected console.error/warn fails the test
pnpm test:coverage # the same, with the coverage thresholds CI enforces
pnpm --filter admin knip   # unused files, exports and dependencies
pnpm --filter admin dup    # jscpd duplication gate (app code and tests measured separately)
pnpm check:licenses        # fails on a production dependency whose license is AGPL-incompatible or unknown
pnpm audit --audit-level high && pnpm audit --prod --audit-level moderate   # the CI audit gates
pnpm dev          # runs the dashboard dev server (admin)
```

## Auth + API

In production the dashboard calls the API same-origin: `admin.civfix.org` sits behind Cloudflare Access,
and the edge serves the SPA and proxies `/v1/admin/*` to the backend, so `NEXT_PUBLIC_API_URL` stays
unset. A development build defaults to `http://localhost:8080`; see `apps/admin/.env.example`.

Operator sign-in is the Cloudflare Access exchange: the dashboard first reuses an existing operator
session, and otherwise posts to the admin Access-exchange route, which trades the Access identity the
edge attached for an `operator` session. An Access identity whose email is not on the operator
allowlist gets the "forbidden" screen. The shell renders only after an operator session exists.
Cookies, CSRF and `x-client: web` are sent exactly as the public web app sends them.

## Deploy

Cloudflare Pages (Direct Upload). GitHub Actions builds the static export (a plain checkout +
`pnpm install`, which fetches `@civfix/contract` and `@civfix/tokens` from `repo.civfix.org`; pinned Node 22 + the pnpm that `packageManager` pins)
and ships the prebuilt `apps/admin/out` via `wrangler pages deploy`. The Pages project name and output
dir come from the repo-root `wrangler.jsonc`
(`civfix-admin` -> `apps/admin/out`). A push to `main` deploys staging (`admin.civfix.dev`); a published
`v*` release deploys production (`admin.civfix.org`). See `.github/workflows/deploy.yml`.

## License

civfix-admin is free software, licensed under the
[GNU Affero General Public License, version 3 only](LICENSE). Every file is
covered by the declaration in [REUSE.toml](REUSE.toml); there are no per-file
license headers. The dashboard honors the AGPL's source offer with the
"Source code" link on its home screen and sign-in screen, which points at the
deployed commit. Contributions are accepted under the
[Contributor License Agreement](CLA.md); see
[CONTRIBUTING.md](CONTRIBUTING.md). civfix is a project of Reach Out Los Angeles Inc.; the civfix name and
logos are its trademarks and are not covered by the license.

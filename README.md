# civfix-admin

Workspace for the civfix ADMIN / OPERATOR dashboard, served at `admin.civfix.org`. A pnpm + Turbo
monorepo. This is the internal tool operators use to triage reports, route jurisdiction contacts,
moderate content, run mail outreach, provision government accounts, and read analytics. It is a
sibling of `civfix-shared`, `civfix-backend`, `civfix-web`, and `civfix-mobile`.

## Layout

```
civfix-admin/
  apps/admin/           # the operator dashboard (Next.js 15 static-export SPA). See its source.
  .npmrc                # @civfix:registry=https://repo.civfix.org/ (installs @civfix/shared)
  pnpm-workspace.yaml   # workspace packages: apps/*
  turbo.json            # build/typecheck/lint task graph
  wrangler.jsonc        # Cloudflare Pages project "civfix-admin" -> apps/admin/out -> admin.civfix.org
```

`@civfix/shared` (the shared contract package) is installed from the private Verdaccio registry at
`https://repo.civfix.org`. The repo-root `.npmrc` scopes `@civfix` to it and the app depends on a
published version (`^0.1.0` today); the registry allows anonymous read, so no credentials are needed.
After cloning, `pnpm install` fetches it — there is no submodule to initialize. The published tarball
already contains the built `dist`, so no local build of the contract is required.

## Commands (from this root)

```
pnpm install      # fetches @civfix/shared from repo.civfix.org
pnpm build        # admin (next build, static export -> apps/admin/out)
pnpm typecheck
pnpm lint
pnpm dev          # runs the dashboard dev server (admin)
```

## Auth + API

The dashboard talks to the civfix API at `NEXT_PUBLIC_API_URL` (inlined at build time; see
`.env.example`). Operator sign-in reuses the civfix Email-OTP flow through the allowlist-gated
`/admin/auth/*` routes; only emails in the backend `ADMIN_EMAILS` allowlist can receive a code. The
shell renders only after an authenticated `operator` session exists; otherwise the login gate shows.
Cookies + CSRF + `x-client: web` are sent exactly as the public web app does. The API's
`WEB_ORIGINS` must include `https://admin.civfix.org`.

## Deploy

Cloudflare Pages (Direct Upload). GitHub Actions builds the static export (a plain checkout +
`pnpm install`, which fetches `@civfix/shared` from `repo.civfix.org`; pinned Node 22 + pnpm 9.12.0)
and ships the prebuilt `apps/admin/out` via `wrangler pages deploy`. The Pages project name and output
dir come from the repo-root `wrangler.jsonc`
(`civfix-admin` -> `apps/admin/out`). See `.github/workflows/deploy.yml` and
`../documents/phase2/07-civfix-admin-repo.md`.

## License

civfix-admin is free software, licensed under the
[GNU Affero General Public License, version 3 only](LICENSE). Every file is
covered by the declaration in [REUSE.toml](REUSE.toml); there are no per-file
license headers. The dashboard honors the AGPL's source offer with the
"Source code" link on its home screen and sign-in screen, which points at the
deployed commit. Contributions are accepted under the
[Contributor License Agreement](CLA.md) — see
[CONTRIBUTING.md](CONTRIBUTING.md). civfix is a project of Reach Out Los Angeles; the civfix name and
logos are its trademarks and are not covered by the license.

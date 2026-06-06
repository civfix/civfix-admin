# civfix-admin

Workspace for the civfix ADMIN / OPERATOR dashboard, served at `admin.civfix.org`. A pnpm + Turbo
monorepo. This is the internal tool operators use to triage reports, route jurisdiction contacts,
moderate content, run mail outreach, provision government accounts, and read analytics. It is a
sibling of `civfix-shared`, `civfix-backend`, `civfix-web`, and `civfix-mobile`.

## Layout

```
civfix-admin/
  apps/admin/           # the operator dashboard (Next.js 15 static-export SPA). See its source.
  shared/               # @civfix/shared, wired as a git submodule (the shared contract package).
  pnpm-workspace.yaml   # workspace packages: shared, apps/*
  turbo.json            # build/typecheck/lint; typecheck+build dependsOn ^build (shared builds first)
  wrangler.jsonc        # Cloudflare Pages project "civfix-admin" -> apps/admin/out -> admin.civfix.org
```

`shared` is a git submodule pointing at the sibling `civfix-shared` repository (relative URL
`../civfix-shared`). After cloning:

```
git submodule update --init --recursive
```

`@civfix/shared` ships its build output to `shared/dist` (git-ignored in that repo), so Turbo builds
it first via the `^build` dependency before the app builds, typechecks, or lints.

## Commands (from this root)

```
pnpm install
pnpm build        # shared (tsup) then admin (next build, static export -> apps/admin/out)
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

Cloudflare Pages (Direct Upload). GitHub Actions builds the static export with the `shared/` submodule
checked out (pinned Node 22 + pnpm 9.12.0) and ships the prebuilt `apps/admin/out` via
`wrangler pages deploy`. The Pages project name and output dir come from the repo-root `wrangler.jsonc`
(`civfix-admin` -> `apps/admin/out`). See `.github/workflows/deploy.yml` and
`../documents/phase2/07-civfix-admin-repo.md`.

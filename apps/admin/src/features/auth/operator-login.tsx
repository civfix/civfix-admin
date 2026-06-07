"use client"

import * as React from "react"

import { useOperatorBootstrap, useOperatorSession } from "@/hooks/use-admin-auth"

/**
 * Full-page operator gate (Cloudflare Access SSO, doc 16; same-origin deployment), styled with the admin
 * design system. The dashboard renders this whenever there is no authenticated operator session (see
 * providers.tsx).
 *
 * Authentication is delegated to Cloudflare Access and the user has already passed it to load this SPA
 * (the whole origin is Access-gated). The AuthHydrator establishes the operator session on mount. This
 * screen covers the two states where that did not produce a session:
 *   - anonymous: the exchange could not be completed (Access misconfigured / backend unreachable /
 *     transient). Offer a retry.
 *   - forbidden: Access authenticated the user but their email is not on the operator allowlist (a clean
 *     403). Terminal - show a clear not-authorized message.
 */
export function OperatorLogin() {
  const { status } = useOperatorSession()
  const bootstrap = useOperatorBootstrap()

  const notAuthorized = status === "forbidden"

  return (
    <div className="op-login">
      <div className="op-login-card card">
        <div className="op-login-head">
          <span className="op-login-bug" aria-hidden="true">
            {/* Tiny static brand SVG: <img> is appropriate (static export, images.unoptimized). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/ds/pinit-bug.svg" alt="" width={26} height={30} />
          </span>
          <div className="op-login-brand">
            civfix <span className="op-login-tag">OPERATIONS</span>
          </div>
        </div>

        {notAuthorized ? (
          <>
            <h1 className="op-login-title">Not authorized</h1>
            <p className="op-login-sub">
              You signed in with Cloudflare Access, but this account is not authorized for the operator
              dashboard. Ask an administrator to add your email to the operator allowlist.
            </p>
            <p role="alert" className="op-login-error">
              This account is not authorized for the operator dashboard.
            </p>
          </>
        ) : (
          <>
            <h1 className="op-login-title">Operator sign in</h1>
            <p className="op-login-sub">
              We couldn&apos;t establish your operator session. You are signed in with Cloudflare Access;
              try again to finish signing in.
            </p>
            <button
              type="button"
              className="btn primary lg block op-login-submit"
              onClick={() => void bootstrap()}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  )
}

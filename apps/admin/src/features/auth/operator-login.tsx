"use client"

import * as React from "react"

import { useOperatorBootstrap, useOperatorSession } from "@/hooks/use-admin-auth"
import { SOURCE } from "@/lib/source"

// No credential form: the whole origin is Access-gated, so anyone seeing this has already signed in to
// Access and only the operator session exchange failed or was refused.
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
            <p role="alert" className="op-login-sub">
              You signed in with Cloudflare Access, but this account is not authorized for the operator
              dashboard. Ask an administrator to add your email to the operator allowlist.
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
        <p className="op-login-source">
          <a href={SOURCE.url} target="_blank" rel="noreferrer noopener">
            Source code (AGPL-3.0)
          </a>
        </p>
      </div>
    </div>
  )
}

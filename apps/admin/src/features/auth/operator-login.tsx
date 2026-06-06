"use client"

import * as React from "react"

import { applyOtpInput } from "@/lib/otp"
import { errorMessage } from "@/lib/error-messages"
import { useRequestAdminOtp, useVerifyAdminOtp, useRefreshSession } from "@/hooks/use-admin-auth"

type Step = "email" | "code"

const OTP_LENGTH = 6

/**
 * Full-page operator login gate (Email-OTP), modeled on community-web's auth-modal but as a page and
 * styled with the admin design system. The dashboard renders this whenever there is no authenticated
 * operator session (see providers.tsx).
 *
 * Flow (decisions section 1):
 *   1. email step  -> adminLogin({ email })       (POST /admin/auth/otp/request)
 *   2. code step   -> adminVerifyOtp({ email, code }) (POST /admin/auth/otp/verify)
 *   3. refreshSession() confirms the operator role from GET /admin/auth/session.
 *
 * The request response is identical whether or not the email is allowlisted (no enumeration), so the UI
 * always advances to the code step. Error states surface rate-limit, invalid code, and not-authorized.
 */
export function OperatorLogin() {
  const requestOtp = useRequestAdminOtp()
  const verifyOtp = useVerifyAdminOtp()
  const refreshSession = useRefreshSession()

  const [step, setStep] = React.useState<Step>("email")
  const [email, setEmail] = React.useState("")
  const [code, setCode] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [resendAfter, setResendAfter] = React.useState(0)

  const otpRefs = React.useRef<Array<HTMLInputElement | null>>([])

  // Tick down the resend cooldown.
  React.useEffect(() => {
    if (resendAfter <= 0) return
    const t = setInterval(() => setResendAfter((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendAfter])

  const requestCode = React.useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      setError(null)
      setSubmitting(true)
      try {
        const res = await requestOtp.mutateAsync({ email })
        setResendAfter(res.resendAfterSec)
        setCode("")
        setStep("code")
      } catch (err) {
        setError(authErrorMessage(err))
      } finally {
        setSubmitting(false)
      }
    },
    [email, requestOtp],
  )

  const verifyCode = React.useCallback(
    async (rawCode: string) => {
      setError(null)
      setSubmitting(true)
      try {
        await verifyOtp.mutateAsync({ email, code: rawCode })
        // Confirm the operator role from the canonical session endpoint. If the verified email is
        // somehow not an operator, refreshSession resolves false and we show a not-authorized error.
        const ok = await refreshSession()
        if (!ok) {
          setError("This account is not authorized for the operator dashboard.")
          setCode("")
          otpRefs.current[0]?.focus()
        }
        // On success the auth store flips to authenticated+operator and providers.tsx unmounts the gate.
      } catch (err) {
        setError(authErrorMessage(err))
        setCode("")
        otpRefs.current[0]?.focus()
      } finally {
        setSubmitting(false)
      }
    },
    [email, verifyOtp, refreshSession],
  )

  // Apply input at cell i and keep the single `code` string in sync. `raw` may be one typed digit OR
  // several at once (paste / one-time-code autofill into the first cell). applyOtpInput distributes the
  // digits and tells us where to move focus and whether the code is complete; then we auto-submit.
  const setOtpAt = React.useCallback(
    (i: number, raw: string) => {
      const { code: next, focusIndex, complete } = applyOtpInput(code, i, raw, OTP_LENGTH)
      setCode(next)
      otpRefs.current[focusIndex]?.focus()
      if (complete && !submitting) {
        setTimeout(() => verifyCode(next), 0)
      }
      setError(null)
    },
    [code, submitting, verifyCode],
  )

  const onOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      otpRefs.current[i - 1]?.focus()
    }
  }

  const onOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text")
    if (!text.replace(/\D/g, "")) return
    e.preventDefault()
    const { code: next, focusIndex, complete } = applyOtpInput("", 0, text, OTP_LENGTH)
    setCode(next)
    otpRefs.current[focusIndex]?.focus()
    if (complete && !submitting) setTimeout(() => verifyCode(next), 0)
    setError(null)
  }

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

        {step === "email" && (
          <>
            <h1 className="op-login-title">Operator sign in</h1>
            <p className="op-login-sub">
              Enter your operator email. We will send a 6-digit code. Access is limited to authorized
              operators.
            </p>
            <form className="op-login-form" onSubmit={requestCode}>
              <div className="field">
                <label className="lbl" htmlFor="op-email">
                  Email
                </label>
                <input
                  id="op-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  required
                  placeholder="you@civfix.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Operator email address"
                />
              </div>
              <button
                type="submit"
                className="btn primary lg block op-login-submit"
                disabled={submitting || !email.includes("@")}
              >
                {submitting && <span className="op-login-spin" aria-hidden="true" />}
                Send me a code
              </button>
              {error && (
                <p role="alert" className="op-login-error">
                  {error}
                </p>
              )}
            </form>
          </>
        )}

        {step === "code" && (
          <>
            <h1 className="op-login-title">Check your inbox</h1>
            <p className="op-login-sub">
              Code sent to <strong>{email}</strong> - expires in 5 min.
            </p>

            <div
              className="otp-row"
              onPaste={onOtpPaste}
              role="group"
              aria-label="6-digit verification code"
            >
              {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                <input
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  ref={(el) => {
                    otpRefs.current[i] = el
                  }}
                  className="otp-cell"
                  value={code[i] ?? ""}
                  autoFocus={i === 0}
                  onChange={(e) => setOtpAt(i, e.target.value)}
                  onKeyDown={(e) => onOtpKeyDown(i, e)}
                  maxLength={1}
                  inputMode="numeric"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  disabled={submitting}
                  aria-label={`Digit ${i + 1}`}
                />
              ))}
            </div>

            {error && (
              <p role="alert" className="op-login-error">
                {error}
              </p>
            )}

            <button
              type="button"
              className="btn primary lg block op-login-submit"
              disabled={code.length !== OTP_LENGTH || submitting}
              onClick={() => verifyCode(code)}
            >
              {submitting && <span className="op-login-spin" aria-hidden="true" />}
              {submitting ? "Verifying..." : "Verify code"}
            </button>

            <div className="op-login-resend">
              Did not get it?{" "}
              <button
                type="button"
                disabled={resendAfter > 0 || submitting}
                onClick={() => requestCode()}
              >
                {resendAfter > 0 ? `Resend in ${resendAfter}s` : "Resend"}
              </button>
            </div>
            <button
              type="button"
              className="btn ghost block"
              onClick={() => {
                setError(null)
                setCode("")
                setStep("email")
              }}
            >
              Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Friendly copy for the handful of auth errors the operator can act on. */
function authErrorMessage(err: unknown): string {
  return errorMessage(err, {
    VALIDATION: "That code does not look right. Please check and try again.",
    RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
    UNAUTHORIZED: "That code is invalid or expired. Request a new one.",
    FORBIDDEN: "This account is not authorized for the operator dashboard.",
  })
}

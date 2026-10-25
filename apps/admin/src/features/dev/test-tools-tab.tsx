"use client"

import * as React from "react"
import { DEV_TEST_PUSH_BODY_MAX_LENGTH, DEV_TEST_PUSH_TITLE_MAX_LENGTH } from "@civfix/contract"

import { ErrorState, LoadingState } from "@/components/shared/data-states"
import { formatDateTime } from "@/lib/dates"
import { errorMessage } from "@/lib/error-messages"
import { FieldError, fieldErrorId } from "@/features/orgs/org-form-fields"
import { useDevConfirm } from "@/features/dev/dev-confirm"
import { Card } from "@/features/dev/overview-tab"
import { useDevOverview } from "@/features/dev/use-dev"
import {
  useDevForceUpdate,
  useDevResetFirstRun,
  useDevTestEmail,
  useDevTestPush,
  useSetDevForceUpdate,
} from "@/features/dev/use-dev-test-tools"

const NO_ACCOUNTS = "No test accounts are set up."
const PUSH_BODY_ROWS = 2

/** A tool's last outcome: what it did, or the API's reason it refused. */
function Outcome({ result, error }: { result: string | null; error: unknown }) {
  const id = React.useId()
  if (error) return <FieldError id={fieldErrorId(id)} text={errorMessage(error)} />
  return result ? <p className="muted">{result}</p> : null
}

/** A card whose tool acts on one test account, picked from the configured ones. */
function AccountTool({
  title,
  accounts,
  children,
}: {
  title: string
  accounts: string[]
  children: (email: string) => React.ReactNode
}) {
  const pickerId = React.useId()
  const [picked, setPicked] = React.useState("")
  // The list comes from the overview and can change under the card; a pick no longer offered falls
  // back to the first account.
  const email = accounts.includes(picked) ? picked : accounts[0]

  return (
    <Card title={title}>
      {email === undefined ? (
        <p className="muted">{NO_ACCOUNTS}</p>
      ) : (
        <div className="dev-stack">
          <div className="field">
            <label className="lbl" htmlFor={pickerId}>
              Test account
            </label>
            <select id={pickerId} value={email} onChange={(e) => setPicked(e.target.value)}>
              {accounts.map((account) => (
                <option key={account} value={account}>
                  {account}
                </option>
              ))}
            </select>
          </div>
          {children(email)}
        </div>
      )}
    </Card>
  )
}

function ForcedList({ onTurnOff, busy }: { onTurnOff: (email: string) => void; busy: boolean }) {
  const forced = useDevForceUpdate()
  if (forced.isPending) return <LoadingState label="Loading forced accounts..." />
  if (forced.isError) return <ErrorState error={forced.error} onRetry={() => void forced.refetch()} />
  if (forced.data.accounts.length === 0) return <p className="muted">No accounts are forced to update.</p>
  return (
    <ul className="dev-list" aria-label="Forced to update">
      {forced.data.accounts.map((account) => (
        <li key={account.userId}>
          <span className="mono">{account.email}</span>
          <span className="muted">Until {formatDateTime(account.expiresAt)}</span>
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => onTurnOff(account.email)}>
            Turn off
          </button>
        </li>
      ))}
    </ul>
  )
}

function ForceUpdate({ email }: { email: string }) {
  const setForce = useSetDevForceUpdate()
  const confirm = useDevConfirm()

  const turnOn = async () => {
    if (await confirm({ title: `Force ${email} to update?`, verb: "Change" })) {
      setForce.mutate({ email, enabled: true })
    }
  }

  return (
    <>
      <div className="row-flex">
        <button type="button" className="btn sm" disabled={setForce.isPending} onClick={() => void turnOn()}>
          Turn on
        </button>
      </div>
      <Outcome result={null} error={setForce.error} />
      <ForcedList busy={setForce.isPending} onTurnOff={(account) => setForce.mutate({ email: account, enabled: false })} />
    </>
  )
}

function devicesSent(devices: number): string {
  return `Sent to ${devices} ${devices === 1 ? "device" : "devices"}`
}

function TestPush({ email }: { email: string }) {
  const push = useDevTestPush()
  const titleId = React.useId()
  const bodyId = React.useId()
  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")

  const send = () => {
    // A field left empty is left out of the request, so the API's default text is used.
    const pushTitle = title.trim()
    const pushBody = body.trim()
    push.mutate({ email, ...(pushTitle ? { title: pushTitle } : {}), ...(pushBody ? { body: pushBody } : {}) })
  }

  return (
    <>
      <div className="field">
        <label className="lbl" htmlFor={titleId}>
          Title
          <span className="opt">optional</span>
          <span className="counter mono">
            {title.length}/{DEV_TEST_PUSH_TITLE_MAX_LENGTH}
          </span>
        </label>
        <input
          id={titleId}
          type="text"
          value={title}
          maxLength={DEV_TEST_PUSH_TITLE_MAX_LENGTH}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="field">
        <label className="lbl" htmlFor={bodyId}>
          Message
          <span className="opt">optional</span>
          <span className="counter mono">
            {body.length}/{DEV_TEST_PUSH_BODY_MAX_LENGTH}
          </span>
        </label>
        <textarea
          id={bodyId}
          rows={PUSH_BODY_ROWS}
          value={body}
          maxLength={DEV_TEST_PUSH_BODY_MAX_LENGTH}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div className="row-flex">
        <button type="button" className="btn sm" disabled={push.isPending} onClick={send}>
          Send
        </button>
      </div>
      <Outcome result={push.data ? devicesSent(push.data.devices) : null} error={push.error} />
    </>
  )
}

function TestEmail() {
  const send = useDevTestEmail()
  return (
    <Card title="Test email">
      <div className="dev-stack">
        <p className="muted">Sends a plain test email to your own address.</p>
        <div className="row-flex">
          <button type="button" className="btn sm" disabled={send.isPending} onClick={() => send.mutate()}>
            Send to me
          </button>
        </div>
        <Outcome result={send.data ? `Sent to ${send.data.to}` : null} error={send.error} />
      </div>
    </Card>
  )
}

function ResetFirstRun({ email }: { email: string }) {
  const reset = useDevResetFirstRun()
  const confirm = useDevConfirm()

  const run = async () => {
    if (await confirm({ title: `Reset first run for ${email}?`, verb: "Change" })) reset.mutate({ email })
  }

  return (
    <>
      <div className="row-flex">
        <button type="button" className="btn sm" disabled={reset.isPending} onClick={() => void run()}>
          Reset
        </button>
      </div>
      <Outcome result={reset.isSuccess ? "First run reset" : null} error={reset.error} />
    </>
  )
}

export function TestToolsTab() {
  const overview = useDevOverview()

  if (!overview.data) {
    return overview.isError ? (
      <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
    ) : (
      <LoadingState label="Loading test tools..." />
    )
  }
  if (!overview.data.devToolsEnabled) return <p className="muted">Test tools are off in this environment.</p>

  const accounts = overview.data.testAccounts
  return (
    <div className="dev-grid">
      <Card title="Test accounts">
        {accounts.length === 0 ? (
          <p className="muted">{NO_ACCOUNTS}</p>
        ) : (
          <ul className="dev-list">
            {accounts.map((account) => (
              <li key={account} className="mono">
                {account}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <AccountTool title="Force update" accounts={accounts}>
        {(email) => <ForceUpdate email={email} />}
      </AccountTool>
      <AccountTool title="Test push" accounts={accounts}>
        {(email) => <TestPush email={email} />}
      </AccountTool>
      <TestEmail />
      <AccountTool title="Reset first run" accounts={accounts}>
        {(email) => <ResetFirstRun email={email} />}
      </AccountTool>
    </div>
  )
}

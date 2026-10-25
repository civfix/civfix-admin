"use client"

import * as React from "react"
import type { AdminDevOverviewResponse, SystemService } from "@civfix/contract"

import { ErrorState, LoadingState } from "@/components/shared/data-states"
import { useNow } from "@/hooks/use-now"
import { sourceLink } from "@/lib/source"
import { ENVIRONMENT_LABEL } from "@/features/dev/dev-environment"
import { Ago, NOT_SET, seamLabel } from "@/features/dev/dev-format"
import { useDevOverview, useDevSystemHealth } from "@/features/dev/use-dev"

// The abbreviation GitHub shows for a commit, so the value matches the linked page.
const SHORT_COMMIT_LENGTH = 7

const STATUS_LABEL: Record<SystemService["status"], string> = {
  ok: "OK",
  warn: "Warning",
  down: "Down",
  not_deployed: "Not deployed",
}

const STATUS_TONE: Record<SystemService["status"], string> = {
  ok: "is-ok",
  warn: "is-warn",
  down: "is-down",
  not_deployed: "is-off",
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <h3>{title}</h3>
      </div>
      <div className="card-pad">{children}</div>
    </section>
  )
}

function Fields({ rows }: { rows: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="dev-kv">
      {rows.map(({ label, value }) => (
        <div key={label} className="dev-kv-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Commit({ repo, value }: { repo: string; value: string | null | undefined }) {
  if (!value) return NOT_SET
  // sourceLink accepts only a commit sha, so any other build value is shown as sent and never linked.
  const sha = sourceLink(value).commit
  if (!sha) return <span className="mono">{value}</span>
  return (
    <a className="mono" href={`https://github.com/civfix/${repo}/commit/${sha}`} target="_blank" rel="noreferrer noopener">
      {sha.slice(0, SHORT_COMMIT_LENGTH)}
    </a>
  )
}

function Mono({ value }: { value: string | null }) {
  return value ? <span className="mono">{value}</span> : NOT_SET
}

function BuildsCard({ overview, now }: { overview: AdminDevOverviewResponse; now: number }) {
  const { api, worker } = overview
  return (
    <Card title="Environment and builds">
      <Fields
        rows={[
          { label: "Environment", value: ENVIRONMENT_LABEL[overview.environment] },
          { label: "API commit", value: <Commit repo="civfix-backend" value={api.commit} /> },
          { label: "Release", value: <Mono value={api.releaseRef} /> },
          { label: "API image", value: <Mono value={api.image} /> },
          { label: "API started", value: <Ago value={api.startedAt} now={now} /> },
          { label: "Contract version", value: <Mono value={api.contractVersion} /> },
          { label: "Node version", value: <Mono value={api.nodeVersion} /> },
          { label: "Worker image", value: <Mono value={worker.image} /> },
          {
            label: "Worker last job",
            value: worker.lastJobCompletedAt ? <Ago value={worker.lastJobCompletedAt} now={now} /> : NOT_SET,
          },
          // Read at render, not at import: the build inlines it either way, and a test can set it.
          { label: "Admin commit", value: <Commit repo="civfix-admin" value={process.env.NEXT_PUBLIC_COMMIT_SHA} /> },
        ]}
      />
    </Card>
  )
}

function HealthCard() {
  const health = useDevSystemHealth()
  let body: React.ReactNode
  if (health.isPending) body = <LoadingState label="Loading health..." />
  else if (health.isError) body = <ErrorState error={health.error} onRetry={() => void health.refetch()} />
  else if (health.data.services.length === 0) body = <p className="muted">No health checks reported.</p>
  else {
    body = (
      <ul className="dev-health" aria-label="System health">
        {health.data.services.map((service) => (
          <li key={service.name}>
            <span
              className={`dev-dot ${STATUS_TONE[service.status]}`}
              role="img"
              aria-label={STATUS_LABEL[service.status]}
            />
            <span className="dev-health-name">{service.name}</span>
            <span className="dev-health-val mono">{service.val}</span>
          </li>
        ))}
      </ul>
    )
  }
  return <Card title="System health">{body}</Card>
}

function ServicesCard({ seams }: { seams: AdminDevOverviewResponse["seams"] }) {
  return (
    <Card title="Services">
      {seams.length === 0 ? (
        <p className="muted">No services reported.</p>
      ) : (
        <Fields
          rows={seams.map((seam) => ({
            label: seamLabel(seam.name),
            value:
              seam.mode === "real" ? (
                <span className="pill status-ok">Real</span>
              ) : (
                <span className="pill priority-low">Fake</span>
              ),
          }))}
        />
      )}
    </Card>
  )
}

function SettingsCard({ settings }: { settings: AdminDevOverviewResponse["settings"] }) {
  return (
    <Card title="Settings">
      {settings.length === 0 ? (
        <p className="muted">No settings reported.</p>
      ) : (
        <Fields rows={settings.map((setting) => ({ label: setting.key, value: setting.value }))} />
      )}
    </Card>
  )
}

export function OverviewTab() {
  const overview = useDevOverview()
  const now = useNow()

  return (
    <>
      {overview.isPending && <LoadingState label="Loading overview..." />}
      {overview.isError && !overview.data && (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      )}
      <div className="dev-grid">
        {overview.data && <BuildsCard overview={overview.data} now={now} />}
        <HealthCard />
        {overview.data && <ServicesCard seams={overview.data.seams} />}
        {overview.data && <SettingsCard settings={overview.data.settings} />}
      </div>
    </>
  )
}

"use client"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { EmptyState } from "@/components/shared/page-primitives"
import { useSystemHealth } from "@/hooks/use-admin-home"

/**
 * System health card (ported from queues.jsx MailSystem - the service-health portion). Reads GET
 * /admin/system/health. Each service reports a status (ok / warn / down / not_deployed) and a value;
 * the backend supplies the reconciled names (e.g. media worker, Valhalla marked not deployed).
 */

const LED_CLASS: Record<string, string> = {
  ok: "ok",
  warn: "warn",
  down: "down",
  not_deployed: "warn",
}

export function SystemCard() {
  const q = useSystemHealth()
  const services = q.data?.services ?? []
  const okCount = services.filter((s) => s.status === "ok").length
  const warnCount = services.filter((s) => s.status !== "ok").length
  const allHealthy = services.length > 0 && warnCount === 0

  return (
    <section className="card">
      <div className="card-head">
        <h3>System health</h3>
        <div className="spacer" />
      </div>
      {q.isLoading ? (
        <LoadingState label="Checking services..." />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Could not load health" />
      ) : services.length === 0 ? (
        <EmptyState icon={<Icons.Activity size={20} />} title="No services reported" />
      ) : (
        <div className="msys">
          <div className="msys-row">
            <span className="msys-label">
              <span className={`led ${allHealthy ? "ok" : "warn"}`} />
              {allHealthy ? "All services healthy" : "Some services need attention"}
            </span>
            <span className="msys-spacer" />
            <span className="msys-val muted">
              {okCount} ok - {warnCount} warn
            </span>
          </div>
          {services.map((s) => (
            <div key={s.name} className="msys-row">
              <span className="msys-label">
                <span className={`led ${LED_CLASS[s.status] ?? "warn"}`} />
                {s.name}
              </span>
              <span className="msys-spacer" />
              <span className={`msys-val ${s.status === "ok" ? "" : LED_CLASS[s.status] ?? "warn"}`}>
                {s.val}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

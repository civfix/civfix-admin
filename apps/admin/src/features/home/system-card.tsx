"use client"

import type { SystemHealthResponse } from "@civfix/shared"

import { Icons } from "@/components/icons"
import { LoadingState, ErrorState } from "@/components/shared/data-states"
import { EmptyState } from "@/components/shared/page-primitives"
import { useSystemHealth } from "@/hooks/use-admin-home"

/**
 * System health card (ported from queues.jsx MailSystem - the service-health portion). Reads GET
 * /admin/system/health. Each service reports a status (ok / warn / down / not_deployed) and a value;
 * the backend supplies the reconciled names (e.g. media worker, Valhalla marked not deployed).
 *
 * LED treatment per status: ok -> moss, warn -> amber, down -> red (bad), not_deployed -> a neutral
 * "off" LED so a deliberately-not-deployed Phase-3 service (Valhalla/VRP) reads distinctly from an
 * actual degraded/down service rather than as an amber warning (decisions sec 8).
 */

type ServiceStatus = SystemHealthResponse["services"][number]["status"]

const LED_CLASS: Record<ServiceStatus, string> = {
  ok: "ok",
  warn: "warn",
  down: "bad",
  not_deployed: "off",
}

export function SystemCard() {
  const q = useSystemHealth()
  const services = q.data?.services ?? []
  const okCount = services.filter((s) => s.status === "ok").length
  // not_deployed is neutral (deliberately off), not a problem; only warn/down count as needing attention.
  const attnCount = services.filter((s) => s.status === "warn" || s.status === "down").length
  const allHealthy = services.length > 0 && attnCount === 0

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
              {okCount} ok - {attnCount} warn
            </span>
          </div>
          {services.map((s) => (
            <div key={s.name} className="msys-row">
              <span className="msys-label">
                <span className={`led ${LED_CLASS[s.status]}`} />
                {s.name}
              </span>
              <span className="msys-spacer" />
              <span
                className={`msys-val ${
                  s.status === "ok" ? "" : s.status === "not_deployed" ? "muted" : LED_CLASS[s.status]
                }`}
              >
                {s.val}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

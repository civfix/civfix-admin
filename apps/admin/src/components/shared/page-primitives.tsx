"use client"

import * as React from "react"

import { Icons } from "@/components/icons"

export function PageHead({
  title,
  subtitle,
  children,
  meta,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Right-side actions. */
  children?: React.ReactNode
  meta?: React.ReactNode
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="subtitle">{subtitle}</div>}
      </div>
      {children && <div className="actions">{children}</div>}
      {meta && <div className="greet-time">{meta}</div>}
    </div>
  )
}

export type FilterOption = string | { value: string; label: string; count?: React.ReactNode }

export function FilterChips({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
}) {
  return (
    <div className="filter-chips" role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value
        const label = typeof o === "string" ? o : o.label
        const count = typeof o === "object" ? o.count : undefined
        return (
          <button
            key={val}
            type="button"
            className={`fchip ${value === val ? "active" : ""}`}
            aria-pressed={value === val}
            onClick={() => onChange(val)}
          >
            {label}
            {count !== undefined && <span className="fchip-count">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  sub,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  sub?: React.ReactNode
}) {
  return (
    <div className="empty-state">
      <div className="empty-pin">{icon ?? <Icons.Check size={20} />}</div>
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
    </div>
  )
}

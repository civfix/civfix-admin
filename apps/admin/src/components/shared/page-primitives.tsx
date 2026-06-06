"use client"

import * as React from "react"

import { Icons } from "@/components/icons"

/**
 * Shared page primitives, ported from the design (pages-shared.jsx). The section pages compose these to
 * match the prototype's structure exactly (class names + DOM preserved).
 */

/** Page header with title, subtitle, and right-side actions (and optional meta on the far right). */
export function PageHead({
  title,
  subtitle,
  children,
  meta,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Right-side actions (buttons). */
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

/** One option in a FilterChips control: either a bare string or a { value, label, count }. */
export type FilterOption = string | { value: string; label: string; count?: number }

/** Segmented filter control (`.filter-chips`). */
export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="filter-chips">
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value
        const label = typeof o === "string" ? o : o.label
        const count = typeof o === "object" ? o.count : undefined
        return (
          <button
            key={val}
            className={`fchip ${value === val ? "active" : ""}`}
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

/** Empty state (`.empty-state`). */
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
